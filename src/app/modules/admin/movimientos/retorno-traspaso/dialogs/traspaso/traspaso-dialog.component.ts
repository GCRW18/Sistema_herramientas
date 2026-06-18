import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, finalize, map } from 'rxjs/operators';

import { MovementService } from '../../../../../../core/services/movement.service';
import { ToolService } from '../../../../../../core/services/tool.service';
import {
    Ubicacion, ToolEnvioItem, Funcionario, CONDICIONES_ENVIO, TIPOS_TRASPASO, abrirBlob
} from '../../retorno-traspaso.types';

export interface TraspasoDialogData {
    almacenes: Ubicacion[];
    bases: Ubicacion[];
    defaultAlmacen?: Ubicacion | null;
    correlativo?: string;
}

@Component({
    selector: 'app-traspaso-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule
    ],
    templateUrl: './traspaso-dialog.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
    `]
})
export class TraspasoDialogComponent implements OnInit, OnDestroy {

    private dialogRef = inject(MatDialogRef<TraspasoDialogComponent>);
    data              = inject<TraspasoDialogData>(MAT_DIALOG_DATA);
    private fb        = inject(FormBuilder);
    private snackBar  = inject(MatSnackBar);
    private movSvc    = inject(MovementService);
    private toolSvc   = inject(ToolService);
    private _unsub$   = new Subject<void>();
    private _srchTraspaso$        = new Subject<string>();
    private _srchTraspasoResp$    = new Subject<string>();
    private _srchTraspasoAut$     = new Subject<string>();
    private _srchTraspasoRecibe$  = new Subject<string>();

    // Form + items
    traspasoForm!: FormGroup;
    itemsTraspaso: ToolEnvioItem[] = [];
    activeTraspasoChip: number | null = null;
    isSavingTraspaso = false;

    // Correlativo
    trpCorrelativoPreview = '';
    loadingCorrelativoTrp = false;

    // Locations
    get almacenes(): Ubicacion[] { return this.data.almacenes || []; }
    get bases(): Ubicacion[] { return this.data.bases || []; }

    // Tool search
    toolSearchTraspaso    = '';
    toolResultsTraspaso: any[] = [];
    showToolDropTraspaso  = false;
    searchingToolsTraspaso = false;

    // Dept autocomplete
    deptUbicacionesTraspaso: Ubicacion[] = [];
    showDeptDropTraspaso = false;

    // Funcionario — Responsable
    funcionariosTraspasoResp: Funcionario[] = [];
    funcTraspasoRespLoading = false;
    showFuncTraspasoRespDropdown = false;

    // Funcionario — Autorizado
    funcionariosTraspasoAut: Funcionario[] = [];
    funcTraspasoAutLoading = false;
    showFuncTraspasoAutDropdown = false;

    // Funcionario — Recibe
    funcionariosTraspasoRecibe: Funcionario[] = [];
    funcTraspasoRecibeLoading = false;
    showFuncTraspasoRecibeDropdown = false;

    condicionesEnvio = CONDICIONES_ENVIO;
    tiposTraspaso    = TIPOS_TRASPASO;

    ngOnInit(): void {
        const today = new Date().toISOString().split('T')[0];
        const hora  = new Date().toTimeString().slice(0, 5);
        this.traspasoForm = this.fb.group({
            baseOrigen:           [this.data.defaultAlmacen ?? null],
            areaDepartamento:     ['', Validators.required],
            fechaTraspaso:        [today, Validators.required],
            horaTraspaso:         [hora],
            responsableTraspaso:  ['', Validators.required],
            autorizadoPor:        ['', Validators.required],
            recibeEnDestino:      ['', Validators.required],
            tipoTraspaso:         ['TEMPORAL', Validators.required],
            fechaRetornoEsperada: [''],
            nroDocumento:         [''],
            notas:                ['']
        });
        this._setupSearches();
        this._loadCorrelativo();
    }

    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    private _loadCorrelativo(): void {
        this.loadingCorrelativoTrp = true;
        this.movSvc.getSiguienteCorrelativoPreview('TRP').pipe(
            finalize(() => this.loadingCorrelativoTrp = false),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (nro: string) => {
                this.trpCorrelativoPreview = nro || 'TRP-?';
                this.traspasoForm.patchValue({ nroDocumento: nro }, { emitEvent: false });
            },
            error: () => { this.trpCorrelativoPreview = 'TRP-?'; }
        });
    }

    private _setupSearches(): void {
        // Tool search
        this._srchTraspaso$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                if (!term || term.trim().length < 2) {
                    this.toolResultsTraspaso = []; this.showToolDropTraspaso = false; return of([]);
                }
                this.searchingToolsTraspaso = true;
                return this.toolSvc.getTools({ query: term.trim() }).pipe(finalize(() => this.searchingToolsTraspaso = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (tools: any[]) => {
            this.toolResultsTraspaso = tools.slice(0, 12);
            this.showToolDropTraspaso = this.toolResultsTraspaso.length > 0;
        }});

        // Funcionario searches
        this._srchTraspasoResp$.pipe(debounceTime(300), distinctUntilChanged(),
            switchMap(q => {
                if (!q || q.length < 2) { this.funcionariosTraspasoResp = []; this.showFuncTraspasoRespDropdown = false; return of([]); }
                this.funcTraspasoRespLoading = true;
                const ql = q.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(ql))
                        .slice(0, 10).map(f => ({ id: String(f.id_employee || f.id || ''), nombre: f.nombreCompleto || f.nombre || '', cargo: f.cargo || '' }))),
                    finalize(() => this.funcTraspasoRespLoading = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (r: any[]) => { this.funcionariosTraspasoResp = r; this.showFuncTraspasoRespDropdown = r.length > 0; }});

        this._srchTraspasoAut$.pipe(debounceTime(300), distinctUntilChanged(),
            switchMap(q => {
                if (!q || q.length < 2) { this.funcionariosTraspasoAut = []; this.showFuncTraspasoAutDropdown = false; return of([]); }
                this.funcTraspasoAutLoading = true;
                const ql = q.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(ql))
                        .slice(0, 10).map(f => ({ id: String(f.id_employee || f.id || ''), nombre: f.nombreCompleto || f.nombre || '', cargo: f.cargo || '' }))),
                    finalize(() => this.funcTraspasoAutLoading = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (r: any[]) => { this.funcionariosTraspasoAut = r; this.showFuncTraspasoAutDropdown = r.length > 0; }});

        this._srchTraspasoRecibe$.pipe(debounceTime(300), distinctUntilChanged(),
            switchMap(q => {
                if (!q || q.length < 2) { this.funcionariosTraspasoRecibe = []; this.showFuncTraspasoRecibeDropdown = false; return of([]); }
                this.funcTraspasoRecibeLoading = true;
                const ql = q.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(ql))
                        .slice(0, 10).map(f => ({ id: String(f.id_employee || f.id || ''), nombre: f.nombreCompleto || f.nombre || '', cargo: f.cargo || '' }))),
                    finalize(() => this.funcTraspasoRecibeLoading = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (r: any[]) => { this.funcionariosTraspasoRecibe = r; this.showFuncTraspasoRecibeDropdown = r.length > 0; }});
    }

    // — Tool search methods —
    onToolSearchTraspaso(term: string): void { this.toolSearchTraspaso = term; this._srchTraspaso$.next(term); }
    hideToolDropTraspaso(): void { setTimeout(() => this.showToolDropTraspaso = false, 150); }

    addToolTraspaso(tool: any): void {
        const id = tool.id_tool ?? tool.id;
        if (this.itemsTraspaso.some(i => i.toolId === id)) { this._showMsg('Herramienta ya en la lista', 'warning'); return; }
        this.itemsTraspaso.push({
            toolId: id, codigo: tool.code ?? tool.codigo ?? '',
            nombre: tool.name ?? tool.description ?? '', pn: tool.part_number ?? '',
            sn: tool.serial_number ?? '', marca: tool.brand ?? '', fechaVencCal: '',
            cantidad: 1, condicion: 'good', notas: ''
        });
        this.toolSearchTraspaso = ''; this.toolResultsTraspaso = []; this.showToolDropTraspaso = false;
    }

    removeToolTraspaso(i: number): void { this.itemsTraspaso.splice(i, 1); }

    // — Dept autocomplete —
    onDeptChangeTraspaso(val: string): void {
        if (!val || val.trim().length < 2) { this.deptUbicacionesTraspaso = []; this.showDeptDropTraspaso = false; return; }
        const q = val.toLowerCase();
        this.deptUbicacionesTraspaso = [...this.almacenes, ...this.bases].filter(u => u.nombre.toLowerCase().includes(q)).slice(0, 8);
        this.showDeptDropTraspaso = this.deptUbicacionesTraspaso.length > 0;
    }
    hideDeptDropTraspaso(): void { setTimeout(() => this.showDeptDropTraspaso = false, 150); }
    selectDeptTraspaso(nombre: string): void { this.traspasoForm.patchValue({ areaDepartamento: nombre }); this.showDeptDropTraspaso = false; }

    // — Funcionario methods —
    onResponsableTraspasoInput(val: string): void { this.traspasoForm.patchValue({ responsableTraspaso: val }, { emitEvent: false }); this._srchTraspasoResp$.next(val); }
    hideFuncTraspasoRespDropdown(): void { setTimeout(() => this.showFuncTraspasoRespDropdown = false, 150); }
    selectFuncionarioTraspasoResp(f: Funcionario): void { this.traspasoForm.patchValue({ responsableTraspaso: f.nombre }); this.showFuncTraspasoRespDropdown = false; }

    onAutorizadoTraspasoInput(val: string): void { this.traspasoForm.patchValue({ autorizadoPor: val }, { emitEvent: false }); this._srchTraspasoAut$.next(val); }
    hideFuncTraspasoAutDropdown(): void { setTimeout(() => this.showFuncTraspasoAutDropdown = false, 150); }
    selectFuncionarioTraspasoAut(f: Funcionario): void { this.traspasoForm.patchValue({ autorizadoPor: f.nombre }); this.showFuncTraspasoAutDropdown = false; }

    onRecibeTraspasoInput(val: string): void { this.traspasoForm.patchValue({ recibeEnDestino: val }, { emitEvent: false }); this._srchTraspasoRecibe$.next(val); }
    hideFuncTraspasoRecibeDropdown(): void { setTimeout(() => this.showFuncTraspasoRecibeDropdown = false, 150); }
    selectFuncionarioTraspasoRecibe(f: Funcionario): void { this.traspasoForm.patchValue({ recibeEnDestino: f.nombre }); this.showFuncTraspasoRecibeDropdown = false; }

    requiereFechaRetornoTrp(): boolean {
        const tipo = this.traspasoForm.get('tipoTraspaso')?.value;
        return tipo === 'TEMPORAL' || tipo === 'PRESTAMO';
    }

    canSaveTraspaso(): boolean {
        return this.traspasoForm.valid && this.itemsTraspaso.length > 0 && !this.isSavingTraspaso;
    }

    guardarTraspaso(): void {
        if (!this.canSaveTraspaso()) {
            this.traspasoForm.markAllAsTouched();
            this._showMsg(this.itemsTraspaso.length === 0 ? 'Agregue al menos una herramienta' : 'Complete los campos requeridos', 'warning');
            return;
        }
        const form = this.traspasoForm.value;
        const itemsJson = JSON.stringify(this.itemsTraspaso.map(it => ({
            tool_id: it.toolId, quantity: it.cantidad,
            condition_on_movement: it.condicion,
            serial_number: it.sn || '', part_number: it.pn || '', notes: it.notas || ''
        })));
        this.isSavingTraspaso = true;
        const payload: any = {
            date: form.fechaTraspaso, time: (form.horaTraspaso || '00:00') + ':00',
            source_warehouse_id: form.baseOrigen?.id ? Number(form.baseOrigen.id) : undefined,
            requested_by_name:   form.responsableTraspaso || '',
            responsible_person:  form.responsableTraspaso || '',
            received_by_name:    form.recibeEnDestino     || '',
            department:          form.areaDepartamento    || '',
            document_number:     form.nroDocumento        || '',
            exit_reason:         'area_transfer',
            authorized_by:       form.autorizadoPor       || '',
            transfer_type:       form.tipoTraspaso        || 'TEMPORAL',
            notes:               form.notas               || '',
            items_json:          itemsJson
        };
        if (form.fechaRetornoEsperada && this.requiereFechaRetornoTrp()) {
            payload.expected_return_date = form.fechaRetornoEsperada;
        }
        this.movSvc.registrarTraspasoOtraArea(payload).pipe(
            finalize(() => this.isSavingTraspaso = false),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._showMsg(`Traspaso registrado: ${nro}`, 'success');
                this.dialogRef.close({ refreshActivos: true, movementNumber: nro });
            },
            error: (err: any) => this._showMsg('Error al registrar traspaso: ' + (err?.message || ''), 'error')
        });
    }

    _resetTraspasoTab(): void {
        this.traspasoForm.reset({
            fechaTraspaso: new Date().toISOString().split('T')[0],
            horaTraspaso:  new Date().toTimeString().slice(0, 5),
            baseOrigen: this.data.defaultAlmacen ?? null
        });
        this.itemsTraspaso = [];
        this.funcionariosTraspasoResp   = []; this.showFuncTraspasoRespDropdown   = false;
        this.funcionariosTraspasoAut    = []; this.showFuncTraspasoAutDropdown    = false;
        this.funcionariosTraspasoRecibe = []; this.showFuncTraspasoRecibeDropdown = false;
    }

    cerrarFormTraspaso(): void { this.dialogRef.close(); }

    private _showMsg(msg: string, type: 'success' | 'error' | 'warning'): void {
        const panelClass = type === 'success' ? 'snack-success' : type === 'error' ? 'snack-error' : 'snack-warning';
        this.snackBar.open(msg, '✕', { duration: 4000, panelClass: [panelClass] });
    }
}
