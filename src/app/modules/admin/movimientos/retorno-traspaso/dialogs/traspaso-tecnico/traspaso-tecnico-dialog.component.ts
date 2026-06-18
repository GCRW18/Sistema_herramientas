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
    Ubicacion, ToolEnvioItem, Funcionario, PersonaTecnico, TIPOS_TRASPASO, CONDICIONES_ENVIO
} from '../../retorno-traspaso.types';

export interface TraspasoTecnicoDialogData {
    almacenes: Ubicacion[];
    bases:     Ubicacion[];
    defaultAlmacen?: Ubicacion | null;
}

@Component({
    selector: 'app-traspaso-tecnico-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule
    ],
    templateUrl: './traspaso-tecnico-dialog.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
    `]
})
export class TraspasoTecnicoDialogComponent implements OnInit, OnDestroy {

    private dialogRef = inject(MatDialogRef<TraspasoTecnicoDialogComponent>);
    data              = inject<TraspasoTecnicoDialogData>(MAT_DIALOG_DATA);
    private fb        = inject(FormBuilder);
    private snackBar  = inject(MatSnackBar);
    private movSvc    = inject(MovementService);
    private toolSvc   = inject(ToolService);
    private _unsub$   = new Subject<void>();
    private _srchTecnico$       = new Subject<string>();
    private _srchPersona$       = new Subject<string>();
    private _srchEntrega$       = new Subject<string>();

    traspasoTecnicoForm!: FormGroup;
    itemsTraspasoTecnico: ToolEnvioItem[] = [];
    activeTecnicoChip: number | null = null;
    isSavingTraspasoTecnico = false;

    // Locations
    get almacenes(): Ubicacion[] { return this.data.almacenes || []; }
    get bases(): Ubicacion[]     { return this.data.bases     || []; }

    // Tool search
    toolSearchTecnico    = '';
    toolResultsTecnico: any[] = [];
    showToolDropTecnico  = false;
    searchingToolsTecnico = false;

    // Persona técnico autocomplete
    personasTecnico: PersonaTecnico[]  = [];
    personaTecnicoLoading              = false;
    showPersonaTecnicoDropdown         = false;

    // Funcionario entrega autocomplete
    funcEntregaTecnico: Funcionario[]  = [];
    funcEntregaTecnicoLoading          = false;
    showFuncEntregaTecnicoDropdown     = false;

    tiposTraspasoTecnico = TIPOS_TRASPASO;
    condicionesEnvio     = CONDICIONES_ENVIO;

    ngOnInit(): void {
        const today = new Date().toISOString().split('T')[0];
        this.traspasoTecnicoForm = this.fb.group({
            nombreCompletoInput:   ['', Validators.required],
            nroLicencia:           ['', Validators.required],
            cargo:                 ['', Validators.required],
            responsableEntrega:    ['', Validators.required],
            unidad:                ['', Validators.required],
            fecha:                 [today, Validators.required],
            base:                  [null, Validators.required],
            tipoTraspaso:          ['TEMPORAL'],
            fechaRetornoEsperada:  [''],
            observaciones:         ['']
        });
        this._setupSearches();
    }

    ngOnDestroy(): void { this._unsub$.next(); this._unsub$.complete(); }

    private _setupSearches(): void {
        // Tool search
        this._srchTecnico$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                if (!term || term.trim().length < 2) {
                    this.toolResultsTecnico = []; this.showToolDropTecnico = false; return of([]);
                }
                this.searchingToolsTecnico = true;
                return this.toolSvc.getTools({ query: term.trim() }).pipe(finalize(() => this.searchingToolsTecnico = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (tools: any[]) => {
            this.toolResultsTecnico = tools.slice(0, 12);
            this.showToolDropTecnico = this.toolResultsTecnico.length > 0;
        }});

        // Persona técnico
        this._srchPersona$.pipe(debounceTime(300), distinctUntilChanged(),
            switchMap(q => {
                if (!q || q.length < 2) { this.personasTecnico = []; this.showPersonaTecnicoDropdown = false; return of([]); }
                this.personaTecnicoLoading = true;
                const ql = q.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(ql))
                        .slice(0, 10)
                        .map(f => ({ id: String(f.id_employee || f.id || ''), nombre: f.nombreCompleto || f.nombre || '', cargo: f.cargo || '', licencia: f.nro_licencia || f.licencia || '', area: f.area || f.departamento || '' }))),
                    finalize(() => this.personaTecnicoLoading = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (r: any[]) => {
            this.personasTecnico = r;
            this.showPersonaTecnicoDropdown = this.personasTecnico.length > 0;
        }});

        // Entrega autocomplete
        this._srchEntrega$.pipe(debounceTime(300), distinctUntilChanged(),
            switchMap(q => {
                if (!q || q.length < 2) { this.funcEntregaTecnico = []; this.showFuncEntregaTecnicoDropdown = false; return of([]); }
                this.funcEntregaTecnicoLoading = true;
                const ql = q.toLowerCase();
                return this.movSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(ql))
                        .slice(0, 10)
                        .map(f => ({ id: String(f.id_employee || f.id || ''), nombre: f.nombreCompleto || f.nombre || '', cargo: f.cargo || '' }))),
                    finalize(() => this.funcEntregaTecnicoLoading = false));
            }),
            takeUntil(this._unsub$)
        ).subscribe({ next: (r: any[]) => {
            this.funcEntregaTecnico = r;
            this.showFuncEntregaTecnicoDropdown = r.length > 0;
        }});

        // React to nombre changes for search
        this.traspasoTecnicoForm.get('nombreCompletoInput')!.valueChanges.pipe(
            debounceTime(300), takeUntil(this._unsub$)
        ).subscribe(v => this._srchPersona$.next(v || ''));

        // React to entrega changes
        this.traspasoTecnicoForm.get('responsableEntrega')!.valueChanges.pipe(
            debounceTime(300), takeUntil(this._unsub$)
        ).subscribe(v => this._srchEntrega$.next(v || ''));
    }

    // — Persona técnico —
    hidePersonaTecnicoDropdown(): void { setTimeout(() => this.showPersonaTecnicoDropdown = false, 150); }
    selectPersonaTecnico(p: PersonaTecnico): void {
        this.traspasoTecnicoForm.patchValue({
            nombreCompletoInput: p.nombre, nroLicencia: p.licencia, cargo: p.cargo, unidad: p.area || ''
        });
        this.showPersonaTecnicoDropdown = false;
    }

    // — Entrega —
    hideFuncEntregaTecnicoDropdown(): void { setTimeout(() => this.showFuncEntregaTecnicoDropdown = false, 150); }
    selectFuncEntregaTecnico(f: Funcionario): void { this.traspasoTecnicoForm.patchValue({ responsableEntrega: f.nombre }); this.showFuncEntregaTecnicoDropdown = false; }

    // — Tool search —
    onToolSearchTecnico(term: string): void { this.toolSearchTecnico = term; this._srchTecnico$.next(term); }
    hideToolDropTecnico(): void { setTimeout(() => this.showToolDropTecnico = false, 150); }
    addToolTecnico(tool: any): void {
        const id = tool.id_tool ?? tool.id;
        if (this.itemsTraspasoTecnico.some(i => i.toolId === id)) { this._showMsg('Herramienta ya en la lista', 'warning'); return; }
        this.itemsTraspasoTecnico.push({
            toolId: id, codigo: tool.code ?? tool.codigo ?? '',
            nombre: tool.name ?? tool.description ?? '', pn: tool.part_number ?? '',
            sn: tool.serial_number ?? '', marca: tool.brand ?? '', fechaVencCal: '',
            cantidad: 1, condicion: 'good', notas: ''
        });
        this.toolSearchTecnico = ''; this.toolResultsTecnico = []; this.showToolDropTecnico = false;
    }
    removeToolTecnico(i: number): void { this.itemsTraspasoTecnico.splice(i, 1); }

    requiereFechaRetornoTecnico(): boolean {
        const tipo = this.traspasoTecnicoForm.get('tipoTraspaso')?.value;
        return tipo === 'TEMPORAL' || tipo === 'PRESTAMO';
    }

    canSaveTraspasoTecnico(): boolean {
        return this.traspasoTecnicoForm.valid && this.itemsTraspasoTecnico.length > 0 && !this.isSavingTraspasoTecnico;
    }

    guardarTraspasoTecnico(): void {
        if (!this.canSaveTraspasoTecnico()) {
            this.traspasoTecnicoForm.markAllAsTouched();
            this._showMsg(this.itemsTraspasoTecnico.length === 0 ? 'Agregue al menos una herramienta' : 'Complete los campos requeridos', 'warning');
            return;
        }
        const form = this.traspasoTecnicoForm.value;
        const itemsJson = JSON.stringify(this.itemsTraspasoTecnico.map(it => ({
            tool_id: it.toolId, quantity: it.cantidad,
            condition_on_movement: it.condicion, serial_number: it.sn || '', part_number: it.pn || '', notes: it.notas || ''
        })));
        this.isSavingTraspasoTecnico = true;
        const baseLabel = form.base?.codigo ? `${form.base.codigo} — ${form.base.nombre}` : (form.base?.nombre || '');
        const payload: any = {
            date:               form.fecha,
            time:               new Date().toTimeString().slice(0, 8),
            received_by_name:   form.nombreCompletoInput || '',
            department:         form.unidad              || '',
            requested_by_name:  form.responsableEntrega  || '',
            responsible_person: form.responsableEntrega  || '',
            destination_warehouse_id: form.base?.id ? Number(form.base.id) : undefined,
            exit_reason:        'area_transfer',
            transfer_type:      form.tipoTraspaso        || 'TEMPORAL',
            notes:              form.observaciones       || '',
            specific_observations:   'MGH109',
            general_observations:    `Base: ${baseLabel} | Cargo: ${form.cargo} | Licencia: ${form.nroLicencia}`,
            items_json:         itemsJson
        };
        if (form.fechaRetornoEsperada && this.requiereFechaRetornoTecnico()) {
            payload.expected_return_date = form.fechaRetornoEsperada;
        }
        this.movSvc.registrarTraspasoOtraArea(payload).pipe(
            finalize(() => this.isSavingTraspasoTecnico = false),
            takeUntil(this._unsub$)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._showMsg(`MGH-109 registrado: ${nro}`, 'success');
                this.dialogRef.close({ refreshActivos: true, movementNumber: nro });
            },
            error: (e: any) => this._showMsg('Error al registrar: ' + (e?.message || ''), 'error')
        });
    }

    resetTraspasoTecnicoTab(): void {
        this.traspasoTecnicoForm.reset({ fecha: new Date().toISOString().split('T')[0], tipoTraspaso: 'TEMPORAL' });
        this.itemsTraspasoTecnico = [];
        this.personasTecnico = []; this.showPersonaTecnicoDropdown = false;
        this.funcEntregaTecnico = []; this.showFuncEntregaTecnicoDropdown = false;
    }

    cerrarFormTraspasoTecnico(): void { this.dialogRef.close(); }

    private _showMsg(msg: string, type: 'success' | 'error' | 'warning'): void {
        const panelClass = type === 'success' ? 'snack-success' : type === 'error' ? 'snack-error' : 'snack-warning';
        this.snackBar.open(msg, '✕', { duration: 4000, panelClass: [panelClass] });
    }
}
