import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, forkJoin, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, finalize, map } from 'rxjs/operators';

import { MovementService } from '../../../../../../core/services/movement.service';
import {
    Ubicacion, TraspasoItem, Funcionario, CondRetorno,
    CONDICIONES_RETORNO, ResumenCondicion, isItemValid, getItemErrors
} from '../../retorno-traspaso.types';

export interface RetornoDialogData {
    almacenes: Ubicacion[];
    bases:     Ubicacion[];
    movimiento?: any;
    tipoOrigen?: 'BASE' | 'TRASPASO';
}

@Component({
    selector: 'app-retorno-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule, MatCheckboxModule
    ],
    templateUrl: './retorno-dialog.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
    `]
})
export class RetornoDialogComponent implements OnInit, OnDestroy {

    private dialogRef = inject(MatDialogRef<RetornoDialogComponent>);
    data              = inject<RetornoDialogData>(MAT_DIALOG_DATA);
    private fb        = inject(FormBuilder);
    private snackBar  = inject(MatSnackBar);
    private movSvc    = inject(MovementService);
    private _unsub$   = new Subject<void>();
    private _srchFunc$ = new Subject<string>();

    // Form
    retornoForm!: FormGroup;
    isSavingRetorno  = false;
    isSearching      = false;
    showConfirmModal = false;

    // Items
    allData: TraspasoItem[]    = [];
    dataSource: TraspasoItem[] = [];

    // Funcionario autocomplete
    funcionarios: Funcionario[]  = [];
    funcionariosLoading          = false;
    showFuncDropdown             = false;

    // State
    tipoOrigenActivo: 'BASE' | 'TRASPASO' = 'BASE';

    condiciones = CONDICIONES_RETORNO;

    ngOnInit(): void {
        const today = new Date().toISOString().split('T')[0];
        this.retornoForm = this.fb.group({
            ubicacionOrigen:    [null, Validators.required],
            nroDocumento:       ['', Validators.required],
            fechaRetorno:       [today, Validators.required],
            responsableRecibe:  ['', Validators.required],
            transportista:      [''],
            observaciones:      [''],
            searchText:         new FormControl('')
        });
        this.tipoOrigenActivo = this.data.tipoOrigen || 'BASE';

        // Filter dataSource on searchText changes
        this.retornoForm.get('searchText')!.valueChanges.pipe(
            debounceTime(200), takeUntil(this._unsub$)
        ).subscribe(q => this._filterItems(q));

        // Funcionario autocomplete
        this.retornoForm.get('responsableRecibe')!.valueChanges.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                const q = (term || '').trim();
                if (q.length < 2) { this.funcionarios = []; this.showFuncDropdown = false; return of([]); }
                this.funcionariosLoading = true;
                const ql = q.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(ql))
                        .slice(0, 10).map(f => ({ id: String(f.id_employee || f.id || ''), nombre: f.nombreCompleto || f.nombre || '', cargo: f.cargo || '' }))),
                    finalize(() => this.funcionariosLoading = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (r: any[]) => { this.funcionarios = r; this.showFuncDropdown = r.length > 0; }});

        // Pre-select movement + auto-query if passed from activos table
        if (this.data.movimiento) {
            this.movSeleccionadoParaRetorno = this.data.movimiento;
            const mov = this.data.movimiento;
            const ubicacion = this.getAllUbicaciones().find(u =>
                u.nombre === mov.destination_warehouse_name ||
                String(u.id) === String(mov.destination_warehouse_id)
            ) || null;
            if (ubicacion) {
                this.retornoForm.patchValue({ ubicacionOrigen: ubicacion }, { emitEvent: false });
                setTimeout(() => this.consultarRetorno(), 300);
            }
        }
    }

    movSeleccionadoParaRetorno: any = null;

    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    private _filterItems(q: string): void {
        if (!q) { this.dataSource = [...this.allData]; return; }
        const lq = q.toLowerCase();
        this.dataSource = this.allData.filter(i =>
            i.codigo.toLowerCase().includes(lq) ||
            i.descripcion.toLowerCase().includes(lq) ||
            (i.sn || '').toLowerCase().includes(lq) ||
            (i.pn || '').toLowerCase().includes(lq)
        );
    }

    getAllUbicaciones(): Ubicacion[] { return [...(this.data.almacenes || []), ...(this.data.bases || [])]; }
    getUbicacionesFiltradas(): Ubicacion[] { return this.getAllUbicaciones(); }

    getTipoOrigenLabel(): string { return this.tipoOrigenActivo === 'BASE' ? 'Base' : 'Almacén'; }
    getDocumentoLabel(): string  { return 'Nro. Nota Salida'; }

    hideFuncDropdown(): void { setTimeout(() => this.showFuncDropdown = false, 150); }
    selectFuncionario(f: Funcionario): void { this.retornoForm.patchValue({ responsableRecibe: f.nombre }); this.showFuncDropdown = false; }

    consultarRetorno(): void {
        const origen = this.retornoForm.get('ubicacionOrigen')?.value;
        if (!origen?.id) { this._showMsg('Seleccione una ubicación de origen', 'warning'); return; }
        this.isSearching = true;
        this.allData = []; this.dataSource = [];
        const exitReason   = this.tipoOrigenActivo === 'BASE' ? 'base_send' : 'area_transfer';
        const typeClause   = this.tipoOrigenActivo === 'BASE'
            ? `mos.type IN ('exit','ENVIO_BASE')`
            : `mos.type IN ('exit','TRASPASO')`;
        const destId = Number(origen.id);
        const filtro = `${typeClause} AND mos.exit_reason = '${exitReason}' AND mos.destination_warehouse_id = ${destId} AND mos.status IN ('approved','completed')`;
        this.movSvc.getMovements({ filtro_adicional: filtro, limit: 200 }).pipe(
            takeUntil(this._unsub$), finalize(() => this.isSearching = false)
        ).subscribe({
            next: (movs: any[]) => {
                const filtered = (movs || []).filter((m: any) => m.exit_reason === exitReason);
                if (!filtered.length) { this._showMsg(`Sin movimientos activos para ${origen.nombre}`, 'warning'); return; }
                forkJoin(filtered.map((mov: any) =>
                    this.movSvc.getMovementItems(Number(mov.id_movement)).pipe(
                        map((items: any[]) => ({ mov, items }))
                    )
                )).pipe(takeUntil(this._unsub$)).subscribe({
                    next: (results: any[]) => {
                        const expanded: TraspasoItem[] = [];
                        results.forEach(({ mov, items }) => {
                            (items || []).forEach((item: any) => expanded.push(this._mapItem(mov, item)));
                        });
                        this.allData = expanded; this.dataSource = [...this.allData];
                        if (!this.allData.length) this._showMsg(`Sin herramientas en ${origen.nombre}`, 'warning');
                        else this._showMsg(`Cargadas: ${this.dataSource.length} herramienta(s)`, 'success');
                    }
                });
            },
            error: (e: any) => this._showMsg('Error al consultar: ' + (e?.message || ''), 'error')
        });
    }

    private _mapItem(mov: any, item: any): TraspasoItem {
        const envio = new Date(mov.date || '');
        const diasFuera = mov.date ? Math.ceil(Math.abs(Date.now() - envio.getTime()) / 86400000) : 0;
        return {
            id: String(mov.id_movement || ''),
            filaObs: 0,
            toolId: String(item?.tool_id || item?.tool?.id || ''),
            codigo: item?.tool?.code || item?.code || item?.codigo || '',
            descripcion: item?.tool?.description || item?.description || item?.descripcion || '',
            pn: item?.tool?.part_number || item?.part_number || '',
            sn: item?.tool?.serial_number || item?.serial_number || '',
            marca: item?.tool?.brand || item?.brand || '',
            cantidadEnviada: Number(item?.quantity) || 1,
            cantidadRetorna: Number(item?.quantity) || 1,
            fechaEnvio: mov.date || '', nroNotaSalida: mov.movement_number || '',
            ubicacionOrigen: mov.destination_warehouse_name || '',
            diasFuera,
            selected: false, expanded: false, condicion: '', observacionItem: ''
        };
    }

    // Selection helpers
    toggleSelection(item: TraspasoItem): void {
        item.selected = !item.selected;
        if (item.selected && !item.condicion) item.condicion = 'BUENO' as CondRetorno;
        if (!item.selected) { item.expanded = false; item.condicion = ''; }
    }
    toggleExpand(item: TraspasoItem): void { item.expanded = !item.expanded; }
    isAllSelected(): boolean { return this.dataSource.length > 0 && this.dataSource.every(i => i.selected); }
    isSomeSelected(): boolean { return this.dataSource.some(i => i.selected) && !this.isAllSelected(); }
    toggleAllSelection(e: any): void { this.dataSource.forEach(i => { i.selected = e.checked; if (e.checked && !i.condicion) i.condicion = 'BUENO' as CondRetorno; }); }
    getSelectedCount(): number { return this.dataSource.filter(i => i.selected).length; }
    onCondicionChange(item: TraspasoItem, val: CondRetorno): void { item.condicion = val; item.expanded = true; }
    validateCantidadRetorna(item: TraspasoItem): void {
        if (item.cantidadRetorna < 0) item.cantidadRetorna = 0;
        if (item.cantidadRetorna > item.cantidadEnviada) item.cantidadRetorna = item.cantidadEnviada;
    }

    getResumenCondicion(): ResumenCondicion {
        const sel = this.dataSource.filter(i => i.selected);
        return {
            buenos:     sel.filter(i => i.condicion === 'BUENO').length,
            danados:    sel.filter(i => i.condicion === 'DAÑADO').length,
            calibracion:sel.filter(i => i.condicion === 'REQUIERE_CALIBRACION').length,
            faltantes:  sel.filter(i => i.condicion === 'FALTANTE').length,
            pendientes: sel.filter(i => !i.condicion).length
        };
    }
    getTotalRetornado(): number { return this.dataSource.filter(i => i.selected && i.condicion !== 'FALTANTE').reduce((a, i) => a + (i.cantidadRetorna || 0), 0); }
    getTotalEnviado(): number   { return this.dataSource.filter(i => i.selected).reduce((a, i) => a + i.cantidadEnviada, 0); }

    getItemErrors(item: TraspasoItem): string[] { return getItemErrors(item); }

    getDiasFueraClass(dias?: number): string {
        if (!dias) return 'bg-gray-100 text-gray-600';
        if (dias > 30) return 'bg-red-100 text-red-700';
        if (dias > 14) return 'bg-orange-100 text-orange-700';
        return 'bg-green-100 text-green-700';
    }

    getRowClass(item: TraspasoItem): string {
        if (!item.selected) return '';
        if (!item.condicion) return 'bg-gray-50 dark:bg-slate-700/50';
        if (item.condicion === 'BUENO') return 'bg-green-50 dark:bg-green-900/20';
        if (item.condicion === 'DAÑADO') return 'bg-red-50 dark:bg-red-900/20';
        if (item.condicion === 'REQUIERE_CALIBRACION') return 'bg-yellow-50 dark:bg-yellow-900/20';
        if (item.condicion === 'FALTANTE') return 'bg-red-100 dark:bg-red-900/30';
        return '';
    }

    canProceedRetorno(): boolean {
        const sel = this.dataSource.filter(i => i.selected);
        if (!sel.length) return false;
        if (!this.retornoForm.valid) return false;
        return sel.every(i => isItemValid(i));
    }

    openConfirmModal(): void { if (this.canProceedRetorno()) this.showConfirmModal = true; }
    closeConfirmModal(): void { this.showConfirmModal = false; }

    finalizarRetorno(): void {
        if (!this.canProceedRetorno() || this.isSavingRetorno) return;
        this.isSavingRetorno = true;
        this.showConfirmModal = false;
        const form = this.retornoForm.value;
        const sel  = this.dataSource.filter(i => i.selected);
        const itemsJson = JSON.stringify(sel.map(i => ({
            tool_id:       Number(i.toolId),
            quantity:      i.condicion === 'FALTANTE' ? 0 : i.cantidadRetorna,
            condicion:     i.condicion,
            notes:         i.observacionItem || '',
            serial_number: i.sn || '',
            part_number:   i.pn || ''
        })));
        const type = this.tipoOrigenActivo === 'BASE' ? 'RETORNO_BASE' : 'RETORNO_TRASPASO';
        this.movSvc.registrarRetornoBase({
            type,
            date:               form.fechaRetorno,
            time:               new Date().toTimeString().slice(0, 8),
            requested_by_name:  form.responsableRecibe || '',
            responsible_person: form.responsableRecibe || '',
            document_number:    form.nroDocumento || '',
            destination_warehouse_id: form.ubicacionOrigen?.id ? Number(form.ubicacionOrigen.id) : undefined,
            notes:              form.observaciones || '',
            specific_observations: form.transportista ? `Transportista: ${form.transportista}` : '',
            items_json:         itemsJson
        }).pipe(
            finalize(() => this.isSavingRetorno = false),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (res: any) => {
                const nro = res?.movement_number || '---';
                this._showMsg(`Retorno registrado: ${nro}`, 'success');
                this.dialogRef.close({ refreshActivos: true });
            },
            error: (e: any) => this._showMsg('Error al registrar retorno: ' + (e?.message || ''), 'error')
        });
    }

    cerrarFormRetorno(): void { this.dialogRef.close(); }

    private _showMsg(msg: string, type: 'success' | 'error' | 'warning'): void {
        const panelClass = type === 'success' ? 'snack-success' : type === 'error' ? 'snack-error' : 'snack-warning';
        this.snackBar.open(msg, '✕', { duration: 4000, panelClass: [panelClass] });
    }
}
