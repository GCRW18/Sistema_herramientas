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
import { localDateStr } from '../../../../../../core/utils/date.utils';
import {
    MovimientoActivo, TraspasoItem, Funcionario, CondRetorno,
    CONDICIONES_RETORNO, isItemValid, getItemErrors
} from '../../retorno-traspaso.types';

export interface RetornoAreaDialogData {
    movTraspasosActivos: MovimientoActivo[];
}

@Component({
    selector: 'app-retorno-area-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule, MatCheckboxModule, DatePipe
    ],
    templateUrl: './retorno-area-dialog.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
    `]
})
export class RetornoAreaDialogComponent implements OnInit, OnDestroy {

    private dialogRef = inject(MatDialogRef<RetornoAreaDialogComponent>);
    data              = inject<RetornoAreaDialogData>(MAT_DIALOG_DATA);
    private fb        = inject(FormBuilder);
    private snackBar  = inject(MatSnackBar);
    private movSvc    = inject(MovementService);
    private _unsub$   = new Subject<void>();

    // Movement lists
    movTraspasosActivos:   MovimientoActivo[] = [];
    movAreaSeleccionado:   MovimientoActivo | null = null;
    searchAreaMovimiento   = '';
    showTraspasoDropdown   = false;

    // Items
    retornoAreaItems:      TraspasoItem[] = [];
    loadingRetornoAreaItems = false;

    // Form
    retornoAreaForm!: FormGroup;
    isSavingRetornoArea     = false;
    showRetornoAreaConfirm  = false;

    // Funcionario autocomplete
    funcRetornoAreaRecibe: Funcionario[]  = [];
    funcRetornoAreaRecibeLoading          = false;
    showFuncRetornoAreaRecibeDropdown     = false;

    condiciones = CONDICIONES_RETORNO;

    get movTraspasosFiltrados(): MovimientoActivo[] {
        if (!this.searchAreaMovimiento) return this.movTraspasosActivos;
        const q = this.searchAreaMovimiento.toLowerCase();
        return this.movTraspasosActivos.filter(m =>
            (m.destination_warehouse_name || '').toLowerCase().includes(q) ||
            (m.movement_number            || '').toLowerCase().includes(q) ||
            (m.received_by_name           || '').toLowerCase().includes(q) ||
            (m.source_warehouse_name      || '').toLowerCase().includes(q)
        );
    }

    ngOnInit(): void {
        this.movTraspasosActivos = this.data.movTraspasosActivos || [];
        const today = localDateStr();
        this.retornoAreaForm = this.fb.group({
            fechaRetorno:  [today, Validators.required],
            nroDocumento:  ['', Validators.required],
            recibeAlmacen: ['', Validators.required],
            observaciones: ['']
        });

        // Funcionario search
        this.retornoAreaForm.get('recibeAlmacen')!.valueChanges.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                const q = (term || '').trim();
                if (q.length < 2) { this.funcRetornoAreaRecibe = []; this.showFuncRetornoAreaRecibeDropdown = false; return of([]); }
                this.funcRetornoAreaRecibeLoading = true;
                const ql = q.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(ql))
                        .slice(0, 10).map(f => ({ id: String(f.id_employee || f.id || ''), nombre: f.nombreCompleto || f.nombre || '', cargo: f.cargo || '' }))),
                    finalize(() => this.funcRetornoAreaRecibeLoading = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (r: any[]) => { this.funcRetornoAreaRecibe = r; this.showFuncRetornoAreaRecibeDropdown = r.length > 0; }});

        // Prellena "Recibe en Almacén" con el usuario logueado (editable). emitEvent:false
        // para no disparar el autocompletado de funcionarios al abrir el formulario.
        const currentUser = this._currentUserName();
        if (currentUser) this.retornoAreaForm.patchValue({ recibeAlmacen: currentUser }, { emitEvent: false });
    }

    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    private _currentUserName(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || '';
        } catch { return ''; }
    }

    hideTraspasoDropdown(): void { setTimeout(() => this.showTraspasoDropdown = false, 150); }

    limpiarSeleccionTraspaso(): void {
        this.movAreaSeleccionado = null;
        this.retornoAreaItems = [];
        this.searchAreaMovimiento = '';
    }

    selectTraspasoFromDropdown(mov: MovimientoActivo): void {
        this.searchAreaMovimiento = mov.movement_number;
        this.showTraspasoDropdown = false;
        this.seleccionarMovimientoArea(mov);
    }

    seleccionarMovimientoArea(mov: MovimientoActivo): void {
        this.movAreaSeleccionado  = mov;
        this.retornoAreaItems     = [];
        this.loadingRetornoAreaItems = true;
        this.movSvc.getMovementItems(mov.id_movement).pipe(
            finalize(() => this.loadingRetornoAreaItems = false),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (items: any[]) => {
                this.retornoAreaItems = items.map((i: any) => ({
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
    isAllSelectedArea(): boolean  { return this.retornoAreaItems.length > 0 && this.retornoAreaItems.every(i => i.selected); }
    isSomeSelectedArea(): boolean { return this.retornoAreaItems.some(i => i.selected) && !this.isAllSelectedArea(); }
    toggleAllArea(e: any): void { this.retornoAreaItems.forEach(i => { i.selected = e.checked; if (e.checked && !i.condicion) i.condicion = 'BUENO' as CondRetorno; }); }
    toggleSelectionArea(item: TraspasoItem): void {
        if (!item.condicion) item.condicion = 'BUENO' as CondRetorno;
    }
    getSelectedArea(): TraspasoItem[] { return this.retornoAreaItems.filter(i => i.selected); }
    onCondicionChange(item: TraspasoItem, val: CondRetorno): void { item.condicion = val; item.expanded = true; }
    validateCantidadRetorna(item: TraspasoItem): void {
        if (item.cantidadRetorna < 0) item.cantidadRetorna = 0;
        if (item.cantidadRetorna > item.cantidadEnviada) item.cantidadRetorna = item.cantidadEnviada;
    }
    toggleExpand(item: TraspasoItem): void { item.expanded = !item.expanded; }
    getItemErrors(item: TraspasoItem): string[] { return getItemErrors(item); }
    getRowClass(item: TraspasoItem): string {
        if (!item.selected) return '';
        return 'border-black bg-stone-50 dark:bg-slate-700/50';
    }
    getAlertRowClass(status: string): boolean { return status !== 'SIN_FECHA'; }

    // Count helpers
    getAreaBuenosCount():   number { return this.getSelectedArea().filter(i => i.condicion === 'BUENO').length; }
    getAreaCalibCount():    number { return this.getSelectedArea().filter(i => i.condicion === 'REQUIERE_CALIBRACION').length; }
    getAreaDanadosCount():  number { return this.getSelectedArea().filter(i => i.condicion === 'DAÑADO').length; }
    getAreaFaltantesCount():number { return this.getSelectedArea().filter(i => i.condicion === 'FALTANTE').length; }

    // Confirm
    openRetornoAreaConfirm(): void {
        const sel = this.getSelectedArea();
        if (!sel.length) { this._showMsg('Selecciona al menos una herramienta', 'warning'); return; }
        if (!sel.every(i => isItemValid(i))) { this._showMsg('Hay ítems con datos incompletos', 'warning'); return; }
        if (!this.retornoAreaForm.valid) { this.retornoAreaForm.markAllAsTouched(); this._showMsg('Complete los datos de recepción', 'warning'); return; }
        this.showRetornoAreaConfirm = true;
    }
    closeRetornoAreaConfirm(): void { this.showRetornoAreaConfirm = false; }

    finalizarRetornoArea(): void {
        if (this.isSavingRetornoArea || !this.movAreaSeleccionado) return;
        this.isSavingRetornoArea = true;
        this.showRetornoAreaConfirm = false;
        const form = this.retornoAreaForm.value;
        const sel  = this.getSelectedArea();
        const mov  = this.movAreaSeleccionado;
        // Se abre en el mismo tick del clic (gesto de usuario) para que el navegador no
        // bloquee la pestaña nueva cuando el PDF se genera después de que responda el guardado.
        const pdfWin = window.open('', '_blank');
        const itemsJson = JSON.stringify(sel.map(i => ({
            tool_id:       Number(i.toolId),
            quantity:      i.condicion === 'FALTANTE' ? 0 : i.cantidadRetorna,
            condicion:     i.condicion || 'BUENO',
            notes:         i.observacionItem || '',
            serial_number: i.sn  || '',
            part_number:   i.pn  || ''
        })));
        this.movSvc.registrarRetornoBase({
            type:                     'RETORNO_TRASPASO',
            date:                     form.fechaRetorno,
            time:                     new Date().toTimeString().slice(0, 8),
            // "Devuelto por" de la acta = el área/almacén que devuelve (no hay una
            // persona individual clara acá, a diferencia del retorno de base) —
            // así la nota compartida (RReporteRetornoNota) no repite el mismo
            // nombre en DEVUELTO POR y RECIBIDO POR.
            requested_by_name:        mov.destination_warehouse_name || form.recibeAlmacen || '',
            responsible_person:       form.recibeAlmacen || '',
            document_number:          form.nroDocumento  || '',
            destination_warehouse_id: mov.source_warehouse_id,
            source_warehouse_id:      mov.destination_warehouse_id,
            notes:                    form.observaciones || '',
            // NO mandar "Cierra: X" acá — he.ft_retorno_base ya lo arma solo a partir de
            // source_movement_ids_json; si se manda también acá queda duplicado en la nota.
            items_json:               itemsJson,
            source_movement_ids_json: JSON.stringify([Number(mov.id_movement)])
        }).pipe(
            finalize(() => this.isSavingRetornoArea = false),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (res: any) => {
                const nro = res?.movement_number || '---';
                this._showMsg(`Retorno registrado: ${nro}`, 'success');
                // Acta de Retorno MGH — mismo reporte TCPDF compartido con Retorno
                // de Base/Traspaso (RReporteRetornoNota ya soporta RETORNO_TRASPASO).
                const idMov = Number(res?.id_movement);
                if (idMov) this.movSvc.verNotaRetorno(idMov, pdfWin);
                else { try { pdfWin?.close(); } catch { /* noop */ } }
                this.dialogRef.close({ refreshActivos: true });
            },
            error: (e: any) => { pdfWin?.close(); this._showMsg('Error: ' + (e?.message || ''), 'error'); }
        });
    }

    // Autocomplete
    hideFuncRetornoAreaRecibeDropdown(): void { setTimeout(() => this.showFuncRetornoAreaRecibeDropdown = false, 150); }
    selectFuncRetornoAreaRecibe(f: Funcionario): void { this.retornoAreaForm.patchValue({ recibeAlmacen: f.nombre }, { emitEvent: false }); this.showFuncRetornoAreaRecibeDropdown = false; }

    cerrarFormRetornoArea(): void { this.dialogRef.close(); }

    private _showMsg(msg: string, type: 'success' | 'error' | 'warning'): void {
        const panelClass = type === 'success' ? 'snack-success' : type === 'error' ? 'snack-error' : 'snack-warning';
        this.snackBar.open(msg, '✕', { duration: 4000, panelClass: [panelClass] });
    }
}
