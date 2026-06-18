import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, finalize, map } from 'rxjs/operators';

import { MovementService } from '../../../../../../core/services/movement.service';
import {
    MovimientoActivo, TraspasoItem, Funcionario, CondRetorno,
    CONDICIONES_RETORNO, isItemValid, getItemErrors
} from '../../retorno-traspaso.types';

export interface DevolucionTecnicoDialogData {
    movTecnicosActivos: MovimientoActivo[];
}

@Component({
    selector: 'app-devolucion-tecnico-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule, MatCheckboxModule, DatePipe
    ],
    templateUrl: './devolucion-tecnico-dialog.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        ::ng-deep .white-checkbox .mdc-checkbox__background { border-color: white !important; }
        ::ng-deep .white-checkbox.mat-mdc-checkbox-checked .mdc-checkbox__background { background-color: white !important; border-color: white !important; }
        ::ng-deep .white-checkbox .mdc-checkbox__checkmark { color: #0f172a !important; }
    `]
})
export class DevolucionTecnicoDialogComponent implements OnInit, OnDestroy {

    private dialogRef = inject(MatDialogRef<DevolucionTecnicoDialogComponent>);
    data              = inject<DevolucionTecnicoDialogData>(MAT_DIALOG_DATA);
    private fb        = inject(FormBuilder);
    private snackBar  = inject(MatSnackBar);
    private movSvc    = inject(MovementService);
    private _unsub$   = new Subject<void>();

    // Movement list
    movTecnicosActivos:   MovimientoActivo[] = [];
    movTecnicosFiltrados: MovimientoActivo[] = [];
    movTecnicoSeleccionado: MovimientoActivo | null = null;
    searchTecnicoNombre = '';

    // Items
    devolucionTecnicoItems: TraspasoItem[] = [];
    loadingDevolucionItems = false;

    // Form
    devolucionTecnicoForm!: FormGroup;
    isSavingDevolucionTecnico   = false;
    showDevolucionTecnicoConfirm = false;

    // Funcionario autocomplete
    funcDevolucionRecibe: Funcionario[]  = [];
    funcDevolucionRecibeLoading          = false;
    showFuncDevolucionRecibeDropdown     = false;

    condiciones = CONDICIONES_RETORNO;

    ngOnInit(): void {
        this.movTecnicosActivos   = this.data.movTecnicosActivos || [];
        this.movTecnicosFiltrados = [...this.movTecnicosActivos];

        const today = new Date().toISOString().split('T')[0];
        this.devolucionTecnicoForm = this.fb.group({
            fechaDevolucion: [today, Validators.required],
            nroDocumento:    [''],
            recibeAlmacen:   ['', Validators.required],
            observaciones:   ['']
        });

        // Filter on search input
        // (reactive, done in template with getter)

        // Funcionario search
        this.devolucionTecnicoForm.get('recibeAlmacen')!.valueChanges.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                const q = (term || '').trim();
                if (q.length < 2) { this.funcDevolucionRecibe = []; this.showFuncDevolucionRecibeDropdown = false; return of([]); }
                this.funcDevolucionRecibeLoading = true;
                const ql = q.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(ql))
                        .slice(0, 10).map(f => ({ id: String(f.id_employee || f.id || ''), nombre: f.nombreCompleto || f.nombre || '', cargo: f.cargo || '' }))),
                    finalize(() => this.funcDevolucionRecibeLoading = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (r: any[]) => { this.funcDevolucionRecibe = r; this.showFuncDevolucionRecibeDropdown = r.length > 0; }});
    }

    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    // Filter getter (used by template via searchTecnicoNombre)
    get movTecnicosFiltradosActual(): MovimientoActivo[] {
        if (!this.searchTecnicoNombre) return this.movTecnicosActivos;
        const q = this.searchTecnicoNombre.toLowerCase();
        return this.movTecnicosActivos.filter(m =>
            (m.received_by_name || '').toLowerCase().includes(q) ||
            (m.movement_number  || '').toLowerCase().includes(q) ||
            (m.department       || '').toLowerCase().includes(q)
        );
    }

    seleccionarMovimientoTecnico(mov: MovimientoActivo): void {
        this.movTecnicoSeleccionado = mov;
        this.devolucionTecnicoItems = [];
        this.loadingDevolucionItems = true;
        this.movSvc.getMovementItems(mov.id_movement).pipe(
            finalize(() => this.loadingDevolucionItems = false),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (items: any[]) => {
                this.devolucionTecnicoItems = items.map((i: any) => ({
                    id: String(i.id_movement_item || i.id || ''),
                    filaObs: 0, toolId: String(i.tool_id || ''),
                    codigo: i.code || i.codigo || '', descripcion: i.name || i.description || '',
                    pn: i.part_number || '', sn: i.serial_number || '', marca: i.brand || '',
                    cantidadEnviada: Number(i.quantity) || 1, cantidadRetorna: Number(i.quantity) || 1,
                    fechaEnvio: mov.send_date, nroNotaSalida: mov.movement_number,
                    ubicacionOrigen: mov.source_warehouse_name, diasFuera: 0,
                    selected: false, expanded: false, condicion: '', observacionItem: ''
                }));
            },
            error: (e: any) => this._showMsg('Error al cargar ítems: ' + (e?.message || ''), 'error')
        });
    }

    // Selection helpers
    isAllSelectedDevolucion(): boolean  { return this.devolucionTecnicoItems.length > 0 && this.devolucionTecnicoItems.every(i => i.selected); }
    isSomeSelectedDevolucion(): boolean { return this.devolucionTecnicoItems.some(i => i.selected) && !this.isAllSelectedDevolucion(); }
    toggleAllDevolucion(e: any): void { this.devolucionTecnicoItems.forEach(i => { i.selected = e.checked; if (e.checked && !i.condicion) i.condicion = 'BUENO' as CondRetorno; }); }
    toggleSelectionDevolucion(item: TraspasoItem): void {
        item.selected = !item.selected;
        if (item.selected && !item.condicion) item.condicion = 'BUENO' as CondRetorno;
        if (!item.selected) { item.expanded = false; item.condicion = ''; }
    }
    getSelectedDevolucion(): TraspasoItem[] { return this.devolucionTecnicoItems.filter(i => i.selected); }
    onCondicionChange(item: TraspasoItem, val: CondRetorno): void { item.condicion = val; item.expanded = true; }
    validateCantidadRetorna(item: TraspasoItem): void {
        if (item.cantidadRetorna < 0) item.cantidadRetorna = 0;
        if (item.cantidadRetorna > item.cantidadEnviada) item.cantidadRetorna = item.cantidadEnviada;
    }
    getItemErrors(item: TraspasoItem): string[] { return getItemErrors(item); }
    getCondicionCfg(val: string): any { return CONDICIONES_RETORNO.find(c => c.value === val); }
    getRowClass(item: TraspasoItem): string {
        if (!item.selected) return '';
        if (!item.condicion) return 'bg-gray-50 dark:bg-slate-700/50';
        if (item.condicion === 'BUENO') return 'bg-green-50 dark:bg-green-900/20';
        if (item.condicion === 'DAÑADO') return 'bg-red-50 dark:bg-red-900/20';
        if (item.condicion === 'REQUIERE_CALIBRACION') return 'bg-yellow-50 dark:bg-yellow-900/20';
        return 'bg-red-100 dark:bg-red-900/30';
    }

    // Count helpers
    getDevolucionBuenosCount():   number { return this.getSelectedDevolucion().filter(i => i.condicion === 'BUENO').length; }
    getDevolucionDanadosCount():  number { return this.getSelectedDevolucion().filter(i => i.condicion === 'DAÑADO').length; }
    getDevolucionFaltantesCount():number { return this.getSelectedDevolucion().filter(i => i.condicion === 'FALTANTE').length; }

    // Transfer type helpers
    getTransferTypeClass(tipo: string): string {
        if (tipo === 'TEMPORAL') return 'bg-blue-100 text-blue-800 border-blue-300';
        if (tipo === 'PERMANENTE') return 'bg-orange-100 text-orange-800 border-orange-300';
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
    getTransferTypeLabel(tipo: string): string {
        const map: Record<string, string> = { TEMPORAL: 'Temp.', PERMANENTE: 'Perm.', REASIGNACION: 'Reasig.', PRESTAMO: 'Prést.' };
        return map[tipo] || tipo;
    }
    getAlertBadgeClass(status: string): string {
        if (status === 'VENCIDO')  return 'bg-red-100 text-red-700 border-red-300';
        if (status === 'PROXIMO')  return 'bg-orange-100 text-orange-700 border-orange-300';
        return 'bg-green-100 text-green-700 border-green-300';
    }
    getAlertLabel(status: string): string {
        if (status === 'VENCIDO') return '⚠ VENC.';
        if (status === 'PROXIMO') return '↑ PRÓX.';
        return '✓ OK';
    }

    // Confirm
    openDevolucionTecnicoConfirm(): void {
        const sel = this.getSelectedDevolucion();
        if (!sel.length) { this._showMsg('Selecciona al menos una herramienta', 'warning'); return; }
        if (!sel.every(i => isItemValid(i))) { this._showMsg('Hay ítems con datos incompletos', 'warning'); return; }
        if (!this.devolucionTecnicoForm.valid) { this.devolucionTecnicoForm.markAllAsTouched(); this._showMsg('Complete los campos de recepción', 'warning'); return; }
        this.showDevolucionTecnicoConfirm = true;
    }
    closeDevolucionTecnicoConfirm(): void { this.showDevolucionTecnicoConfirm = false; }

    finalizarDevolucionTecnico(): void {
        if (this.isSavingDevolucionTecnico || !this.movTecnicoSeleccionado) return;
        this.isSavingDevolucionTecnico = true;
        this.showDevolucionTecnicoConfirm = false;
        const form = this.devolucionTecnicoForm.value;
        const sel  = this.getSelectedDevolucion();
        const mov  = this.movTecnicoSeleccionado;
        const itemsJson = JSON.stringify(sel.map(i => ({
            tool_id:       Number(i.toolId),
            quantity:      i.condicion === 'FALTANTE' ? 0 : i.cantidadRetorna,
            condicion:     i.condicion || 'BUENO',
            notes:         i.observacionItem || '',
            serial_number: i.sn || '',
            part_number:   i.pn || ''
        })));
        this.movSvc.registrarRetornoBase({
            type:                   'RETORNO_TRASPASO',
            date:                   form.fechaDevolucion,
            time:                   new Date().toTimeString().slice(0, 8),
            requested_by_name:      form.recibeAlmacen || '',
            responsible_person:     form.recibeAlmacen || '',
            document_number:        form.nroDocumento  || '',
            source_warehouse_id:    mov.source_warehouse_id || undefined,
            notes:                  form.observaciones || '',
            specific_observations:  `Retorno de técnico: ${mov.received_by_name || '-'} | Traspaso original: ${mov.movement_number}`,
            items_json:             itemsJson
        }).pipe(
            finalize(() => this.isSavingDevolucionTecnico = false),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (res: any) => {
                const nro = res?.movement_number || '---';
                this._showMsg(`Devolución registrada: ${nro}`, 'success');
                this.dialogRef.close({ refreshActivos: true });
            },
            error: (e: any) => this._showMsg('Error: ' + (e?.message || ''), 'error')
        });
    }

    // Autocomplete
    hideFuncDevolucionRecibeDropdown(): void { setTimeout(() => this.showFuncDevolucionRecibeDropdown = false, 150); }
    selectFuncDevolucionRecibe(f: Funcionario): void { this.devolucionTecnicoForm.patchValue({ recibeAlmacen: f.nombre }); this.showFuncDevolucionRecibeDropdown = false; }

    cerrarFormDevolucionTecnico(): void { this.dialogRef.close(); }

    private _showMsg(msg: string, type: 'success' | 'error' | 'warning'): void {
        const panelClass = type === 'success' ? 'snack-success' : type === 'error' ? 'snack-error' : 'snack-warning';
        this.snackBar.open(msg, '✕', { duration: 4000, panelClass: [panelClass] });
    }
}
