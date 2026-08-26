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
import { localDateStr } from '../../../../../../core/utils/date.utils';
import {
    Ubicacion, TraspasoItem, Funcionario, CondRetorno,
    CONDICIONES_RETORNO, ResumenCondicion, isItemValid, getItemErrors
} from '../../retorno-traspaso.types';
import { RetornoPdfService } from '../../retorno-pdf.service';

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
    private pdfSvc    = inject(RetornoPdfService);
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

    // Ubicación Origen autocomplete
    ubicacionesFiltradas: Ubicacion[] = [];
    showUbicacionDropdown = false;

    ngOnInit(): void {
        const today = localDateStr();
        this.retornoForm = this.fb.group({
            ubicacionOrigen:      [null, Validators.required],
            ubicacionOrigenTexto: [''],
            nroDocumento:         ['', Validators.required],
            fechaRetorno:         [today, Validators.required],
            responsableRecibe:    ['', Validators.required],
            observaciones:        [''],
            searchText:           new FormControl('')
        });
        this.tipoOrigenActivo = this.data.tipoOrigen || 'BASE';

        // Filter dataSource on searchText changes
        this.retornoForm.get('searchText')!.valueChanges.pipe(
            debounceTime(200), takeUntil(this._unsub$)
        ).subscribe(q => this._filterItems(q));

        // Ubicación Origen autocomplete (lista ya cargada en memoria, filtro sincrónico)
        this.retornoForm.get('ubicacionOrigenTexto')!.valueChanges.pipe(
            debounceTime(100), takeUntil(this._unsub$)
        ).subscribe(term => {
            const seleccionActual = this.retornoForm.get('ubicacionOrigen')?.value as Ubicacion | null;
            if (seleccionActual && seleccionActual.nombre !== term) {
                this.retornoForm.patchValue({ ubicacionOrigen: null }, { emitEvent: false });
            }
            const q = (term || '').trim().toLowerCase();
            this.ubicacionesFiltradas = q
                ? this.getAllUbicaciones().filter(u => u.nombre.toLowerCase().includes(q))
                : this.getAllUbicaciones();
            this.showUbicacionDropdown = this.ubicacionesFiltradas.length > 0;
        });

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
                this.retornoForm.patchValue({ ubicacionOrigen: ubicacion, ubicacionOrigenTexto: ubicacion.nombre }, { emitEvent: false });
                setTimeout(() => this._cargarItemsMovimiento(mov), 300);
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

    // Solo almacenes (he.twarehouses): "bases" viene de param.tlugar (id_lugar), un
    // espacio de IDs distinto. ubicacionOrigen.id se manda como destination_warehouse_id,
    // cuya FK apunta a he.twarehouses — mezclar "bases" aquí causa
    // "violates foreign key constraint tmovements_dest_warehouse_fkey".
    getAllUbicaciones(): Ubicacion[] { return this.data.almacenes || []; }
    getUbicacionesFiltradas(): Ubicacion[] { return this.getAllUbicaciones(); }

    getTipoOrigenLabel(): string { return this.tipoOrigenActivo === 'BASE' ? 'Base' : 'Almacén'; }
    getDocumentoLabel(): string  { return 'Nro. Nota Salida'; }

    hideFuncDropdown(): void { setTimeout(() => this.showFuncDropdown = false, 150); }
    selectFuncionario(f: Funcionario): void { this.retornoForm.patchValue({ responsableRecibe: f.nombre }, { emitEvent: false }); this.showFuncDropdown = false; }

    onUbicacionOrigenFocus(): void {
        this.ubicacionesFiltradas = this.getAllUbicaciones().filter(u =>
            u.nombre.toLowerCase().includes((this.retornoForm.get('ubicacionOrigenTexto')?.value || '').trim().toLowerCase())
        );
        this.showUbicacionDropdown = this.ubicacionesFiltradas.length > 0;
    }
    hideUbicacionDropdown(): void { setTimeout(() => this.showUbicacionDropdown = false, 150); }
    selectUbicacionOrigen(u: Ubicacion): void {
        this.retornoForm.patchValue({ ubicacionOrigen: u, ubicacionOrigenTexto: u.nombre }, { emitEvent: false });
        this.showUbicacionDropdown = false;
    }

    consultarRetorno(): void {
        const origen = this.retornoForm.get('ubicacionOrigen')?.value;
        if (!origen?.id) { this._showMsg('Seleccione una ubicación de origen', 'warning'); return; }
        this.isSearching = true;
        this.allData = []; this.dataSource = [];
        const exitReason = this.tipoOrigenActivo === 'BASE' ? 'base_send' : 'area_transfer';
        const destId = Number(origen.id);
        // Misma fuente que la tabla Activos (listarEnviosActivos) — evita depender de
        // filtro_adicional/getMovements, cuyo filtro con literales entre comillas simples
        // se rompe al pasar por el doble-escape de comillas del framework pXP.
        this.movSvc.listarEnviosActivos({ limit: 200 }).pipe(
            takeUntil(this._unsub$), finalize(() => this.isSearching = false)
        ).subscribe({
            next: (movs: any[]) => {
                const filtered = (movs || []).filter((m: any) =>
                    m.exit_reason === exitReason && Number(m.destination_warehouse_id) === destId
                );
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

    /** Carga solo los ítems del movimiento específico pasado desde la tabla Activos
     *  (a diferencia de consultarRetorno(), que trae TODOS los envíos activos hacia
     *  el mismo almacén destino — correcto para la búsqueda manual, incorrecto acá). */
    private _cargarItemsMovimiento(mov: any): void {
        this.isSearching = true;
        this.allData = []; this.dataSource = [];
        this.movSvc.getMovementItems(Number(mov.id_movement)).pipe(
            takeUntil(this._unsub$), finalize(() => this.isSearching = false)
        ).subscribe({
            next: (items: any[]) => {
                this.allData = (items || []).map((item: any) => this._mapItem(mov, item));
                this.dataSource = [...this.allData];
                if (!this.allData.length) this._showMsg(`Sin herramientas en ${mov.movement_number}`, 'warning');
                else this._showMsg(`Cargadas: ${this.dataSource.length} herramienta(s) de ${mov.movement_number}`, 'success');
            },
            error: (e: any) => this._showMsg('Error al cargar ítems: ' + (e?.message || ''), 'error')
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

    getRowClass(item: TraspasoItem): string {
        if (!item.selected) return '';
        return 'bg-stone-50 dark:bg-slate-800/40';
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
        const itemsConNovedad = sel.filter(it => it.condicion === 'DAÑADO' || it.condicion === 'FALTANTE');
        // Se abren en el mismo tick del clic (gesto de usuario) para que el navegador no
        // bloquee la pestaña nueva cuando el PDF se genera después de que responda el guardado.
        const pdfWin = window.open('', '_blank');
        const discrepanciaWin = itemsConNovedad.length > 0 ? window.open('', '_blank') : null;
        const itemsJson = JSON.stringify(sel.map(i => ({
            tool_id:       Number(i.toolId),
            quantity:      i.condicion === 'FALTANTE' ? 0 : i.cantidadRetorna,
            condicion:     i.condicion,
            notes:         i.observacionItem || '',
            serial_number: i.sn || '',
            part_number:   i.pn || ''
        })));
        const type = this.tipoOrigenActivo === 'BASE' ? 'RETORNO_BASE' : 'RETORNO_TRASPASO';
        const sourceMovementIds = [...new Set(sel.map(i => Number(i.id)).filter(id => !!id))];
        this.movSvc.registrarRetornoBase({
            type,
            date:               form.fechaRetorno,
            time:               new Date().toTimeString().slice(0, 8),
            requested_by_name:  form.responsableRecibe || '',
            responsible_person: form.responsableRecibe || '',
            document_number:    form.nroDocumento || '',
            destination_warehouse_id: form.ubicacionOrigen?.id ? Number(form.ubicacionOrigen.id) : undefined,
            notes:              form.observaciones || '',
            items_json:         itemsJson,
            source_movement_ids_json: JSON.stringify(sourceMovementIds)
        }).pipe(
            finalize(() => this.isSavingRetorno = false),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (res: any) => {
                const nro = res?.movement_number || '---';
                this._showMsg(`Retorno registrado: ${nro}`, 'success');
                const pdfForm = {
                    fechaRetorno: form.fechaRetorno,
                    nroDocumento: form.nroDocumento,
                    origenNombre: form.ubicacionOrigen?.nombre || '',
                    responsableRecibe: form.responsableRecibe || '',
                    observaciones: form.observaciones || ''
                };
                this.pdfSvc.generarPdfRetorno(nro, this.tipoOrigenActivo, sel, pdfForm, pdfWin);
                if (itemsConNovedad.length > 0) {
                    this.pdfSvc.generarPdfDiscrepancia(nro, itemsConNovedad, pdfForm, discrepanciaWin);
                }
                this.dialogRef.close({ refreshActivos: true });
            },
            error: (e: any) => {
                pdfWin?.close(); discrepanciaWin?.close();
                this._showMsg('Error al registrar retorno: ' + (e?.message || ''), 'error');
            }
        });
    }

    cerrarFormRetorno(): void { this.dialogRef.close(); }

    private _showMsg(msg: string, type: 'success' | 'error' | 'warning'): void {
        const panelClass = type === 'success' ? 'snack-success' : type === 'error' ? 'snack-error' : 'snack-warning';
        this.snackBar.open(msg, '✕', { duration: 4000, panelClass: [panelClass] });
    }
}
