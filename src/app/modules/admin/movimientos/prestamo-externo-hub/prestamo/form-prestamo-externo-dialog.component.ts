import { Component, OnInit, OnDestroy, signal, inject, ViewChild, TemplateRef, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, catchError, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';
import { CustomerService } from '../../../../../core/services/customer.service';
import { ToolService } from '../../../../../core/services/tool.service';
import { motivoBloqueoSalida } from '../../retorno-traspaso/retorno-traspaso.types';

interface ExternalLoanItem {
    toolId: number; id: number; codigo: string; pn: string; descripcion: string; sn: string;
    marca: string; fechaCalibracion: string; listaContenido: string;
    cantidad: number;
    contenido: string; estado: string;
    // Datos reales de la herramienta (catálogo), para el detalle de solo-lectura.
    imagen?: string | null;
    notesTool?: string;
    warehouseId?: number | null;
    rackId?: number | null;
    levelId?: number | null;
}

@Component({
    selector: 'app-form-prestamo-externo-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatDialogModule, MatSnackBarModule, MatTooltipModule
    ],
    templateUrl: './form-prestamo-externo-dialog.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
    `]
})
export class FormPrestamoExternoDialogComponent implements OnInit, OnDestroy {

    @ViewChild('confirmExternoModal') confirmExternoModal!: TemplateRef<any>;
    @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

    dialogRef        = inject(MatDialogRef<FormPrestamoExternoDialogComponent>);
    private _confirmRef: any = null;

    private dialog      = inject(MatDialog);
    private fb          = inject(FormBuilder);
    private snackBar    = inject(MatSnackBar);
    private movementSvc     = inject(MovementService);
    private customerSvc     = inject(CustomerService);
    private toolSvc         = inject(ToolService);
    private destroy$        = new Subject<void>();

    isSaving = false;
    externalForm!: FormGroup;
    dataSource = signal<ExternalLoanItem[]>([]);

    private _toolSearchPe$ = new Subject<string>();
    toolSearchPe        = '';
    toolSuggestionsPe:  any[] = [];
    showToolDropPe      = false;
    toolSearchLoadingPe = false;

    private _tercerosList: any[] = [];
    empresasFiltradas:   any[] = [];
    showEmpresasDropdown = false;
    _empresaSeleccionada: any = null;

    private _entregadorSearch$ = new Subject<string>();
    entregadoresFiltrados:  any[] = [];
    entregadorLoading      = false;
    showEntregadorDropdown = false;

    tiposMotivo = [
        { value: 'ALQUILER',           label: 'Alquiler por Contrato'  },
        { value: 'APOYO_MUTUO',        label: 'Apoyo Mutuo Operacional' },
        { value: 'REPARACION_EXTERNA', label: 'Reparación Externa'     },
        { value: 'CALIBRACION',        label: 'Calibración Externa'    },
    ];

    private readonly conditionMap: Record<string,string> = {
        'SERVICEABLE':'good','BUENO':'good','NUEVO':'new','NEW':'new',
        'EN_CALIBRACION':'fair','REGULAR':'fair','RECONDITIONED':'fair',
        'UNSERVICEABLE':'damaged','EN_REPARACION':'poor',
        'MALO':'poor','DAÑADO':'damaged','DAMAGED':'damaged',
    };

    ngOnInit(): void {
        this.initForm();
        this._setupEntregadorSearch();
        this._cargarTerceros();
        this._setupToolSearchPe();
        setTimeout(() => this._focusScanPe(), 150);
    }

    ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

    private _focusScanPe(): void {
        try { this.scanInputRef?.nativeElement.focus(); } catch { /* vista no lista */ }
    }

    private _localDateStr(d = new Date()): string {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    private _currentUserName(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || '';
        } catch { return ''; }
    }

    private initForm(): void {
        const now = new Date();
        this.externalForm = this.fb.group({
            nombreEmpresa:  ['', Validators.required],
            nit:            [''],
            contacto:       [''],
            telefono:       [''],
            motivoPrestamo: ['', Validators.required],
            // "Autorizado por" prellenado con el usuario logueado (editable).
            autorizado:     [this._currentUserName(), Validators.required],
            fecha:          [this._localDateStr(), Validators.required],
            hora:           [`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`, Validators.required],
            observaciones:  [''],
        });
    }

    private _cargarTerceros(): void {
        this.customerSvc.getCustomers({ limit: 1000 }).pipe(
            takeUntil(this.destroy$), catchError(() => of([]))
        ).subscribe((clientes: any[]) => {
            this._tercerosList = (clientes || [])
                .filter((c: any) => c.active !== false && c.active !== 'f' && c.active !== 'false')
                .map((c: any) => ({
                    razonSocial:    c.name           || c.company_name || '',
                    nit:            c.tax_id         || c.code         || '',
                    nombreContacto: c.contact_person || '',
                    telefono:       c.phone          || '',
                    email:          c.email          || '',
                }));
        });
    }

    onEmpresaInput(val: string): void {
        this.externalForm.patchValue({ nombreEmpresa: val }, { emitEvent: false });
        this._empresaSeleccionada = null;
        const q = val.trim().toLowerCase();
        this.empresasFiltradas = q.length < 2 ? [] :
            this._tercerosList.filter(e => e.razonSocial.toLowerCase().includes(q) || e.nit.toLowerCase().includes(q)).slice(0,10);
        this.showEmpresasDropdown = this.empresasFiltradas.length > 0;
    }
    selectEmpresa(e: any): void {
        this._empresaSeleccionada = e;
        this.externalForm.patchValue({ nombreEmpresa: e.razonSocial, nit: e.nit||'', contacto: e.nombreContacto||'', telefono: e.telefono||'' });
        this.showEmpresasDropdown = false;
    }
    hideEmpresasDropdown(): void { setTimeout(() => this.showEmpresasDropdown = false, 150); }

    private _setupEntregadorSearch(): void {
        this._entregadorSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showEntregadorDropdown = false; return of([]); }
                this.entregadorLoading = true;
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto,f.nombre,f.apellido_paterno,f.apellido_materno].filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0,10).map(f => ({ nombre: f.nombreCompleto || f.nombre, cargo: f.cargo||'' }))
                    ),
                    finalize(() => this.entregadorLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { this.entregadoresFiltrados = res||[]; this.showEntregadorDropdown = (res||[]).length > 0; });
    }

    onEntregadorInput(v: string): void {
        this.externalForm.patchValue({ autorizado: v }, { emitEvent: false });
        if (v.length >= 2) this._entregadorSearch$.next(v); else this.showEntregadorDropdown = false;
    }
    selectEntregador(e: any): void {
        this.externalForm.patchValue({ autorizado: e.nombre });
        this.showEntregadorDropdown = false;
    }
    hideEntregadorSuggestions(): void { setTimeout(() => this.showEntregadorDropdown = false, 200); }

    private _setupToolSearchPe(): void {
        this._toolSearchPe$.pipe(
            debounceTime(300), distinctUntilChanged(),
            switchMap(term => {
                if (term.length < 2) { this.showToolDropPe = false; return of([]); }
                this.toolSearchLoadingPe = true;
                return this.toolSvc.getTools({ query: term }).pipe(
                    map((tools: any[]) => (tools || [])
                        .map((t: any) => ({
                            id: t.id_tool ?? t.id, codigo: t.code ?? t.codigo ?? '',
                            nombre: t.name ?? t.nombre ?? '', pn: t.part_number ?? t.pn ?? '',
                            sn: t.serial_number ?? t.sn ?? '', marca: t.brand ?? t.marca ?? '',
                            status:           (t.status ?? 'available').toLowerCase(),
                            fechaCalibracion: t.next_calibration_date ?? t.calibration_due_date ?? '',
                            listaContenido:   t.content_list ?? '',
                            imagen:           t.location_photo ?? null,
                            notesTool:        t.notes ?? '',
                            warehouseId:      t.warehouse_id != null ? Number(t.warehouse_id) : null,
                            rackId:           t.rack_id      != null ? Number(t.rack_id)      : null,
                            levelId:          t.level_id     != null ? Number(t.level_id)     : null,
                        }))
                        .slice(0, 12)
                    ),
                    finalize(() => this.toolSearchLoadingPe = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { this.toolSuggestionsPe = res; this.showToolDropPe = res.length > 0; });
    }

    onToolInputPe(value: string): void { this.toolSearchPe = value; this._toolSearchPe$.next(value.trim()); }
    hideToolDropPe(): void { setTimeout(() => this.showToolDropPe = false, 150); }
    selectToolSuggestionPe(tool: any): void { this.toolSearchPe = tool.codigo; this.showToolDropPe = false; this._agregarToolPe(tool); }

    addToolPeFromInput(): void { this.scanAndAddPe(); }

    /** Enter / lector físico: coincidencia exacta en sugerencias, si no resuelve
     *  el código directo contra el backend (getToolByCode). */
    scanAndAddPe(): void {
        const code = this.toolSearchPe.trim();
        if (!code) return;
        const exact = this.toolSuggestionsPe.find(h => h.codigo.toLowerCase() === code.toLowerCase());
        if (exact) { this._agregarToolPe(exact); return; }
        this.toolSearchLoadingPe = true;
        this.toolSvc.getToolByCode(code).pipe(
            finalize(() => this.toolSearchLoadingPe = false),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (raw: any) => {
                if (!raw) { this.showMsg('warning', `No se encontró la herramienta "${code}"`); return; }
                this._agregarToolPe(this._mapToolRow(raw));
            },
            error: () => this.showMsg('error', 'Error al buscar la herramienta')
        });
    }

    private _mapToolRow(t: any): any {
        return {
            id:               t.id_tool ?? t.id,
            codigo:           t.code ?? t.codigo ?? '',
            nombre:           t.name ?? t.nombre ?? t.description ?? '',
            pn:               t.part_number ?? t.pn ?? '',
            sn:               t.serial_number ?? t.sn ?? '',
            marca:            t.brand ?? t.marca ?? '',
            status:           (t.status ?? 'available').toLowerCase(),
            fechaCalibracion: t.next_calibration_date ?? t.calibration_due_date ?? '',
            listaContenido:   t.content_list ?? '',
            imagen:           t.location_photo ?? null,
            notesTool:        t.notes ?? '',
            warehouseId:      t.warehouse_id != null ? Number(t.warehouse_id) : null,
            rackId:           t.rack_id      != null ? Number(t.rack_id)      : null,
            levelId:          t.level_id     != null ? Number(t.level_id)     : null,
        };
    }

    private _agregarToolPe(tool: any): void {
        if (this.dataSource().some(i => i.codigo === tool.codigo)) { this.showMsg('info', `"${tool.nombre}" ya está en la lista`); return; }
        const motivo = motivoBloqueoSalida(tool);
        if (motivo) { this.showMsg('warning', `"${tool.nombre}" no se puede prestar: ${motivo}`); return; }
        const item: ExternalLoanItem = {
            toolId: tool.id ?? 0, id: Date.now(), codigo: tool.codigo || '',
            pn: tool.pn || '', descripcion: tool.nombre || '', sn: tool.sn || '',
            marca: tool.marca || '', fechaCalibracion: tool.fechaCalibracion || '',
            listaContenido: tool.listaContenido || '', cantidad: 1,
            contenido: '', estado: 'SERVICEABLE',
            imagen: tool.imagen ?? null, notesTool: tool.notesTool || '',
            warehouseId: tool.warehouseId ?? null, rackId: tool.rackId ?? null, levelId: tool.levelId ?? null,
        };
        this.dataSource.update(list => [...list, item]);
        this.showMsg('success', `"${item.descripcion}" agregada`);
        this.toolSearchPe = '';
        this.toolSuggestionsPe = [];
        this.showToolDropPe = false;
        setTimeout(() => this._focusScanPe(), 50);
    }

    async abrirDetalleHerramientaItem(item: ExternalLoanItem): Promise<void> {
        const { DetalleHerramientaComponent } = await import('../../ingresos-hub/detalle-herramienta/detalle-herramienta.component');
        const editItem = {
            toolId: item.toolId, codigoBoa: item.codigo, pn: item.pn, sn: item.sn,
            descripcion: item.descripcion, marca: item.marca, tipo: 'HERRAMIENTA',
            estado: item.estado, cantidad: item.cantidad, um: 'PZA', obs: item.notesTool,
            imagenMaster: item.imagen, warehouseId: item.warehouseId,
            rackId: item.rackId, levelId: item.levelId
        };
        this.dialog.open(DetalleHerramientaComponent, {
            width: '800px', maxWidth: '96vw', height: '560px',
            panelClass: 'no-padding-dialog', hasBackdrop: true, disableClose: false, autoFocus: false,
            data: { editItem, viewOnly: true }
        });
    }

    eliminarItem(idx: number): void {
        const item = this.dataSource()[idx];
        this.dataSource.update(list => list.filter((_,i) => i !== idx));
        this.showMsg('info', `"${item.descripcion}" eliminada`);
    }

    hasError(field: string, error: string): boolean {
        const c = this.externalForm.get(field);
        return c ? c.hasError(error) && c.touched : false;
    }

    procesar(): void {
        this.externalForm.markAllAsTouched();
        if (this.externalForm.invalid) { this.showMsg('error', 'Complete los datos requeridos'); return; }
        if (this.dataSource().length === 0) { this.showMsg('warning', 'Agregue al menos una herramienta'); return; }
        this._confirmRef = this.dialog.open(this.confirmExternoModal, {
            width: 'min(920px, 95vw)', maxWidth: '95vw', panelClass: 'no-padding-dialog', disableClose: true
        });
    }
    cerrarConfirm(): void { this._confirmRef?.close(); }

    finalizar(): void {
        this.cerrarConfirm();
        this.isSaving = true;
        const notaWin = this.movementSvc.preAbrirVentanaPdf();
        const fv    = this.externalForm.getRawValue();
        const items = this.dataSource();
        const itemsJson = JSON.stringify(items.map(i => ({
            tool_id: i.toolId, quantity: i.cantidad, notes: i.contenido||'',
            condition: this.conditionMap[i.estado?.toUpperCase()]||'good',
        })));
        this.movementSvc.registrarPrestamoMultiple({
            type: 'PRESTAMO_EXTERNO', date: fv.fecha, time: fv.hora,
            requested_by_name: fv.nombreEmpresa, customer: fv.nombreEmpresa,
            authorized_by: fv.autorizado||'', recipient: fv.contacto||'',
            notes: fv.motivoPrestamo||'', specific_observations: fv.observaciones||'',
            responsible_person: fv.autorizado || '',
            items_json: itemsJson,
        }).pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                const idLoan = Number(result?.id_loan);
                if (idLoan) this.movementSvc.verNotaPrestamo(idLoan, 'mgh100', true, notaWin);
                else { try { notaWin?.close(); } catch { /* noop */ } this.showMsg('warning', `Préstamo ${nro} registrado, pero no se pudo abrir la nota (sin id_loan)`); }
                this.showMsg('success', `Préstamo externo registrado: ${nro}`);
                this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => { try { notaWin?.close(); } catch { /* noop */ } this.showMsg('error', err?.message || 'Error al registrar'); },
        });
    }

    cerrar(): void {
        if (this.dataSource().length > 0 &&
            !confirm(`¿Cancelar el préstamo? Se perderán los ${this.dataSource().length} ítem(s) agregado(s).`)) return;
        this.dialogRef.close();
    }

    private showMsg(type: 'success'|'error'|'info'|'warning', text: string): void {
        this.snackBar.open(text, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
