import { Component, OnInit, OnDestroy, signal, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, finalize } from 'rxjs';

// Material Modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Servicios
import { MovementService } from '../../../../core/services/movement.service';
import { FleetService } from '../../../../core/services/fleet.service';

// Importación Estática de Modales (Evita el error ɵcmp)
import { ModalHerramientaInternoComponent } from './modal-herramienta-interno/modal-herramienta-interno.component';
import { ModalHerramientaExternoComponent } from './modal-herramienta-externo/modal-herramienta-externo.component';

export interface InternalLoanItem {
    toolId: number;
    id: number;
    codigo: string;
    pn: string;
    descripcion: string;
    sn: string;
    marca: string;
    fechaCalibracion: string;
    cantidad: number;
    unidad: string;
    estado: string;
    contenido: string;
    selected?: boolean;
}

export interface ExternalLoanItem {
    toolId: number;
    id: number;
    codigo: string;
    pn: string;
    descripcion: string;
    sn: string;
    marca: string;
    fechaCalibracion: string;
    cantidad: number;
    horas: number;
    estado: string;
    contenido: string;
    costoHora: number;
    precioTotal: number;
    selected?: boolean;
}

interface Tecnico {
    id: string;
    nroLicencia: string;
    apPaterno: string;
    apMaterno: string;
    nombres: string;
    cargo: string;
    area: string;
    base: string;
    nombreCompleto?: string;
}

interface Aeronave {
    matricula: string;
    tipo: string;
    modelo: string;
    msn: string;
}

type ViewMode = 'internal' | 'external';

@Component({
    selector: 'app-prestamo-terceros',
    standalone: true,
    imports: [
        CommonModule, RouterModule, ReactiveFormsModule, FormsModule, MatFormFieldModule,
        MatInputModule, MatButtonModule, MatIconModule, MatTableModule, MatSelectModule,
        MatCheckboxModule, MatDialogModule, MatAutocompleteModule, MatTooltipModule,
        MatProgressSpinnerModule, MatSnackBarModule
    ],
    templateUrl: './prestamo-terceros.component.html',
    styles: [`
      :host { display: block; height: 100%; }
      .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
      :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #fff; }

      .spinner-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(255,255,255,0.8); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
      }
      :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }

      .row-selected { background-color: #fef3c7 !important; border-left: 4px solid #fbbf24 !important; }
      :host-context(.dark) .row-selected { background-color: rgba(251, 191, 36, 0.1) !important; border-left: 4px solid #fbbf24 !important; }

      @keyframes pulse-border {
        0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        50% { border-color: #f87171; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
      }
      .animate-pulse-border { animation: pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

      ::ng-deep .white-checkbox .mdc-checkbox__background { border-color: white !important; }
      ::ng-deep .white-checkbox.mat-mdc-checkbox-checked .mdc-checkbox__background { background-color: white !important; border-color: white !important; }
      ::ng-deep .white-checkbox .mdc-checkbox__checkmark { color: #0f172a !important; }
    `]
})
export class PrestamoTercerosComponent implements OnInit, OnDestroy {
    @ViewChild('datosInternoModal') datosInternoModal!: TemplateRef<any>;
    @ViewChild('confirmInternoModal') confirmInternoModal!: TemplateRef<any>;
    @ViewChild('datosExternoModal') datosExternoModal!: TemplateRef<any>;
    @ViewChild('confirmExternoModal') confirmExternoModal!: TemplateRef<any>;

    public dialogRef = inject(MatDialogRef<PrestamoTercerosComponent>, { optional: true });
    private dialogRefActual: MatDialogRef<any> | null = null;
    private dialog          = inject(MatDialog);
    private fb              = inject(FormBuilder);
    private router          = inject(Router);
    private movementService = inject(MovementService);
    private fleetService    = inject(FleetService);
    private snackBar        = inject(MatSnackBar);
    private destroy$        = new Subject<void>();

    currentView = signal<ViewMode>('internal');
    internalForm!: FormGroup;
    externalForm!: FormGroup;
    isSaving = false;

    nroNotaInterno = signal<string>('---');
    nroNotaExterno = signal<string>('---');

    internalDataSource  = signal<InternalLoanItem[]>([]);
    externalDataSource  = signal<ExternalLoanItem[]>([]);
    importeTotal        = signal<number>(0);

    // Cachés y Filtros
    private personalCache: Tecnico[] = [];
    filteredTecnicos: Tecnico[] = [];
    showTecnicoSuggestions = false;

    aeronaves: Aeronave[] = [{ matricula: 'N/A', tipo: 'No Aplica', modelo: 'N/A', msn: 'N/A' }];
    destinos = ['Servicios', 'Línea', 'Taller', 'Hangar', 'Rampa'];

    private empresasCache: any[] = [];
    filteredEmpresas: any[] = [];
    showEmpresasSuggestions = false;

    private readonly conditionMap: Record<string, string> = {
        'SERVICEABLE': 'good', 'NUEVO': 'new', 'NEW': 'new', 'EN_CALIBRACION': 'fair',
        'UNSERVICEABLE': 'damaged', 'EN_REPARACION': 'poor', 'BUENO': 'good', 'REGULAR': 'fair',
        'MALO': 'poor', 'EXCELENTE': 'excellent', 'DAMAGED': 'damaged'
    };

    tiposMotivoPrestamo = [
        { value: 'ALQUILER', label: 'Alquiler por Contrato' },
        { value: 'APOYO_MUTUO', label: 'Apoyo Mutuo Operacional' },
        { value: 'REPARACION_EXTERNA', label: 'Reparación Externa' },
        { value: 'CALIBRACION', label: 'Calibración Externa' }
    ];

    displayedInternalColumns: string[] = ['select', 'codigo', 'pn', 'descripcion', 'sn', 'marca', 'cantidad', 'estado', 'acciones'];
    displayedExternalColumns: string[] = ['select', 'codigo', 'pn', 'descripcion', 'sn', 'cantidad', 'horas', 'total', 'acciones'];

    ngOnInit(): void {
        this.initInternalForm();
        this.initExternalForm();
        this.cargarPersonal();
        this.cargarAeronaves();
        this.cargarTerceros();
        this.setupFormListeners();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initInternalForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const now   = new Date();
        const hh    = now.getHours().toString().padStart(2, '0');
        const mm    = now.getMinutes().toString().padStart(2, '0');

        this.internalForm = this.fb.group({
            buscarTecnico:    [''],
            nombreCompleto:   ['', Validators.required],
            nroLicencia:      ['', Validators.required],
            cargo:            [''],
            fecha:            [today, Validators.required],
            hora:             [`${hh}:${mm}`, Validators.required],
            matriculaAeronave:['N/A'],
            ordenTrabajo:     [''],
            destino:          [''],
            trabajoEspecial:  [false],
            observaciones:    ['']
        });
    }

    private initExternalForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const now   = new Date();
        const hh    = now.getHours().toString().padStart(2, '0');
        const mm    = now.getMinutes().toString().padStart(2, '0');

        this.externalForm = this.fb.group({
            buscarEmpresa:       [''],
            empresaSeleccionada: [null, Validators.required],
            nombreEmpresa:       ['', Validators.required],
            nit:                 [''],
            contacto:            [''],
            telefono:            [''],
            fecha:               [today, Validators.required],
            hora:                [`${hh}:${mm}`, Validators.required],
            motivoPrestamo:      ['', Validators.required],
            autorizado:          [''],
            observaciones:       ['']
        });
    }

    private setupFormListeners(): void {
        this.internalForm.get('buscarTecnico')?.valueChanges.pipe(takeUntil(this.destroy$), debounceTime(200), distinctUntilChanged()).subscribe(value => {
            if (typeof value === 'string') this.filterTecnicos(value);
        });

        this.externalForm.get('buscarEmpresa')?.valueChanges.pipe(takeUntil(this.destroy$), debounceTime(200), distinctUntilChanged()).subscribe(value => {
            if (typeof value === 'string') this.filterEmpresas(value);
        });
    }

    // ── DATA FETCHING (Personal, Naves, Empresas) ────────────────────────────
    private cargarAeronaves(): void {
        this.fleetService.getAircraft({ limit: 100 } as any).pipe(takeUntil(this.destroy$)).subscribe({
            next: (data: any[]) => {
                const lista: Aeronave[] = data.map(a => ({ matricula: a.registration || a.matricula || '', tipo: a.manufacturer || a.tipo || '', modelo: a.model || a.modelo || '', msn: a.serial_number || a.msn || '' }));
                this.aeronaves = [...lista, { matricula: 'N/A', tipo: 'No Aplica', modelo: 'N/A', msn: 'N/A' }];
            }
        });
    }

    private cargarPersonal(): void {
        this.movementService.getPersonal().pipe(takeUntil(this.destroy$)).subscribe({
            next: (personal) => {
                this.personalCache = personal.map((p: any) => ({
                    id: String(p.id_employee ?? p.id ?? ''), nroLicencia: p.licencia ?? p.nro_licencia ?? '', apPaterno: p.apellido_paterno ?? '', apMaterno: p.apellido_materno ?? '',
                    nombres: p.nombre ?? p.nombreCompleto ?? '', cargo: p.cargo ?? '', area: p.area ?? '', base: 'VVI', nombreCompleto: p.nombreCompleto || `${p.nombre} ${p.apellido_paterno}`
                }));
                this.filteredTecnicos = [...this.personalCache];
            }
        });
    }

    private filterTecnicos(value: string): void {
        if (!value) { this.filteredTecnicos = [...this.personalCache]; return; }
        const term = value.toLowerCase();
        this.filteredTecnicos = this.personalCache.filter(t => (t.nombreCompleto || '').toLowerCase().includes(term) || t.nroLicencia.toLowerCase().includes(term)).slice(0, 10);
        this.showTecnicoSuggestions = this.filteredTecnicos.length > 0;
    }

    selectTecnico(tecnico: Tecnico): void {
        this.internalForm.patchValue({ buscarTecnico: tecnico.nombreCompleto, nombreCompleto: tecnico.nombreCompleto, nroLicencia: tecnico.nroLicencia, cargo: tecnico.cargo });
        this.showTecnicoSuggestions = false;
    }

    hideTecnicoSuggestions(): void { setTimeout(() => { this.showTecnicoSuggestions = false; }, 200); }

    private cargarTerceros(): void {
        this.movementService.getTerceros().pipe(takeUntil(this.destroy$)).subscribe({
            next: (terceros) => {
                this.empresasCache = terceros.map((t: any) => ({ id: t.id_customer ?? t.id, nombre: t.name ?? t.nombre ?? '', nit: t.tax_id ?? t.nit ?? '', contacto: t.contact_name ?? t.contacto ?? '', telefono: t.phone ?? t.telefono ?? '', tipo: t.type ?? t.tipo ?? '' }));
                this.filteredEmpresas = [...this.empresasCache];
            }
        });
    }

    private filterEmpresas(value: string): void {
        if (!value) { this.filteredEmpresas = [...this.empresasCache]; return; }
        const term = value.toLowerCase();
        this.filteredEmpresas = this.empresasCache.filter(e => e.nombre.toLowerCase().includes(term) || (e.nit ?? '').toLowerCase().includes(term)).slice(0, 10);
        this.showEmpresasSuggestions = this.filteredEmpresas.length > 0;
    }

    selectEmpresa(empresa: any): void {
        this.externalForm.patchValue({ buscarEmpresa: empresa.nombre, empresaSeleccionada: empresa, nombreEmpresa: empresa.nombre, nit: empresa.nit ?? '', contacto: empresa.contacto ?? '', telefono: empresa.telefono ?? '' });
        this.showEmpresasSuggestions = false;
    }

    hideEmpresasSuggestions(): void { setTimeout(() => { this.showEmpresasSuggestions = false; }, 200); }


    // ── GESTIÓN DE MODALES DE ENCABEZADO ─────────────────────────────────────
    abrirModalDatosInterno(): void { this.dialogRefActual = this.dialog.open(this.datosInternoModal, { width: '650px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true }); }
    cerrarModalDatosInterno(): void { this.dialogRefActual?.close(); }

    abrirModalConfirmInterno(): void {
        this.internalForm.markAllAsTouched();
        if (this.internalForm.invalid) { this.showMessage('error', 'Complete los datos del préstamo interno'); this.abrirModalDatosInterno(); return; }
        this.dialogRefActual = this.dialog.open(this.confirmInternoModal, { width: '800px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true });
    }
    cerrarModalConfirmInterno(): void { this.dialogRefActual?.close(); }
    isInternalDataValid(): boolean { return this.internalForm.valid; }


    abrirModalDatosExterno(): void { this.dialogRefActual = this.dialog.open(this.datosExternoModal, { width: '650px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true }); }
    cerrarModalDatosExterno(): void { this.dialogRefActual?.close(); }

    abrirModalConfirmExterno(): void {
        this.externalForm.markAllAsTouched();
        if (this.externalForm.invalid) { this.showMessage('error', 'Complete los datos de la empresa'); this.abrirModalDatosExterno(); return; }
        if (this.confirmExternoModal) {
            this.dialogRefActual = this.dialog.open(this.confirmExternoModal, { width: '800px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true });
        } else {
            this.finalizarExterno(); // Si no hay modal de confirmación, procesar directamente
        }
    }
    cerrarModalConfirmExterno(): void { this.dialogRefActual?.close(); }
    isExternalDataValid(): boolean { return this.externalForm.valid; }


    // ── APERTURA DE MODALES PARA AGREGAR ÍTEMS ───────────────────────────────

    // Para PRÉSTAMOS INTERNOS (Técnicos BOA)
    openHerramientasAPrestar(): void {
        const dialogRef = this.dialog.open(ModalHerramientaInternoComponent, {
            width: '900px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                const d = result.data;
                const newItem: InternalLoanItem = {
                    toolId: d.id_tool ?? 0, id: Date.now(), codigo: d.codigo || '', pn: d.pn || '',
                    descripcion: d.nombre || '', sn: d.sn || '', marca: d.marca || '', fechaCalibracion: d.fechaVencimiento || '',
                    cantidad: d.cantidad || 1, unidad: d.unidad || 'PZA', estado: d.estado || 'SERVICEABLE', contenido: d.observacion || '', selected: false
                };
                this.internalDataSource.update(items => [...items, newItem]);
                this.showMessage('success', `Herramienta "${newItem.descripcion}" agregada`);
            }
        });
    }

    // Para PRÉSTAMOS EXTERNOS (Terceros)
    abrirModalAgregarItemExterno(): void {
        const dialogRef = this.dialog.open(ModalHerramientaExternoComponent, {
            width: '850px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                const d = result.data;
                const newItem: ExternalLoanItem = {
                    toolId: d.id_tool ?? 0, id: Date.now(), codigo: d.codigo, pn: d.pn, descripcion: d.nombre,
                    sn: d.sn, marca: d.marca, fechaCalibracion: d.fechaVencimiento, cantidad: d.cantidad || 1,
                    horas: d.horas || 1, estado: d.estado, contenido: d.observacion, costoHora: d.costoHora || 0,
                    precioTotal: (d.horas || 1) * (d.costoHora || 0), selected: false
                };
                this.externalDataSource.update(items => [...items, newItem]);
                this.calcularImporteTotal();
                this.showMessage('success', `Herramienta agregada al préstamo externo`);
            }
        });
    }


    // ── ACCIONES EN TABLAS ───────────────────────────────────────────────────

    toggleSelectionInternal(item: InternalLoanItem): void { item.selected = !item.selected; this.internalDataSource.set([...this.internalDataSource()]); }
    toggleAllSelectionInternal(event: any): void { const checked = event.checked; const items = this.internalDataSource().map(i => ({ ...i, selected: checked })); this.internalDataSource.set(items); }
    isAllSelectedInternal(): boolean { return this.internalDataSource().length > 0 && this.internalDataSource().every(i => i.selected); }
    isSomeSelectedInternal(): boolean { return this.internalDataSource().some(i => i.selected) && !this.isAllSelectedInternal(); }
    getSelectedCountInternal(): number { return this.internalDataSource().filter(i => i.selected).length; }

    toggleSelectionExternal(item: ExternalLoanItem): void { item.selected = !item.selected; this.externalDataSource.set([...this.externalDataSource()]); }
    toggleAllSelectionExternal(event: any): void { const checked = event.checked; const items = this.externalDataSource().map(i => ({ ...i, selected: checked })); this.externalDataSource.set(items); }
    isAllSelectedExternal(): boolean { return this.externalDataSource().length > 0 && this.externalDataSource().every(i => i.selected); }
    isSomeSelectedExternal(): boolean { return this.externalDataSource().some(i => i.selected) && !this.isAllSelectedExternal(); }
    getSelectedCountExternal(): number { return this.externalDataSource().filter(i => i.selected).length; }

    eliminarItemInterno(index: number): void {
        const item = this.internalDataSource()[index];
        this.internalDataSource.update(items => items.filter((_, i) => i !== index));
        this.showMessage('info', `Herramienta "${item.descripcion}" eliminada`);
    }

    eliminarItemExterno(index: number): void {
        const item = this.externalDataSource()[index];
        this.externalDataSource.update(items => items.filter((_, i) => i !== index));
        this.calcularImporteTotal();
        this.showMessage('info', `Herramienta "${item.descripcion}" eliminada`);
    }

    getTotalItemsInterno(): number { return this.internalDataSource().reduce((s, i) => s + i.cantidad, 0); }
    calcularImporteTotal(): void { this.importeTotal.set(this.externalDataSource().reduce((s, i) => s + (i.precioTotal || 0), 0)); }


    // ── NAVEGACIÓN Y FINALIZAR ───────────────────────────────────────────────

    switchView(view: ViewMode): void { this.currentView.set(view); }

    goBack(): void {
        if (this.dialogRef) { this.dialogRef.close(); } else { this.router.navigate(['/salidas']); }
    }

    procesar(): void {
        this.abrirModalConfirmInterno();
    }

    finalizarInterno(): void {
        this.cerrarModalConfirmInterno();
        this.isSaving = true;
        const fv = this.internalForm.getRawValue();
        const items = this.internalDataSource();

        const itemsJson = JSON.stringify(items.map(item => ({ tool_id: item.toolId, quantity: item.cantidad, notes: item.contenido || '', condition: this.conditionMap[item.estado?.toUpperCase()] || 'good' })));

        this.movementService.registrarPrestamoMultiple({
            type: 'PRESTAMO_INTERNO', date: fv.fecha, time: fv.hora, requested_by_name: fv.nombreCompleto,
            technician: fv.nombreCompleto, authorized_by: fv.nroLicencia, department: fv.destino || '',
            aircraft: fv.matriculaAeronave || '', work_order_number: fv.ordenTrabajo || '', special_work: fv.trabajoEspecial || false,
            notes: fv.observaciones || '', items_json: itemsJson
        }).pipe(finalize(() => { this.isSaving = false; }), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.nroNotaInterno.set(nro);
                this.abrirImpresionPrestamoInterno(nro, fv, items);
                this.showMessage('success', `Préstamo registrado: ${nro}`);
                this.internalDataSource.set([]);
                this.initInternalForm();
                if (this.dialogRef) this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => { this.showMessage('error', err?.message || 'Error al registrar'); }
        });
    }

    procesarExterno(): void {
        this.abrirModalConfirmExterno();
    }

    finalizarExterno(): void {
        this.cerrarModalConfirmExterno();
        this.isSaving = true;
        const fv = this.externalForm.getRawValue();
        const items = this.externalDataSource();

        const itemsJson = JSON.stringify(items.map(item => ({ tool_id: item.toolId, quantity: item.cantidad, notes: item.contenido || '', condition: this.conditionMap[item.estado?.toUpperCase()] || 'good', unit_cost: item.costoHora || 0, total_cost: item.precioTotal || 0 })));

        this.movementService.registrarPrestamoMultiple({
            type: 'PRESTAMO_EXTERNO', date: fv.fecha, time: fv.hora, requested_by_name: fv.nombreEmpresa,
            customer: fv.nombreEmpresa, authorized_by: fv.autorizado || '', recipient: fv.contacto || '',
            notes: fv.motivoPrestamo || '', specific_observations: fv.observaciones || '', items_json: itemsJson
        }).pipe(finalize(() => { this.isSaving = false; }), takeUntil(this.destroy$)).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.nroNotaExterno.set(nro);
                this.abrirImpresionPrestamoExterno(nro, fv, items);
                this.showMessage('success', `Préstamo externo registrado: ${nro}`);
                this.externalDataSource.set([]);
                this.calcularImporteTotal();
                this.initExternalForm();
                if (this.dialogRef) this.dialogRef.close({ success: true, movement_number: nro });
            },
            error: (err: any) => { this.showMessage('error', err?.message || 'Error al registrar el préstamo externo'); }
        });
    }

    private showMessage(type: 'success' | 'error' | 'info' | 'warning', text: string): void {
        this.snackBar.open(text, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }

    // ── IMPRESIONES EN PDF ───────────────────────────────────────────────────
    private abrirImpresionPrestamoInterno(nro: string, fv: any, items: InternalLoanItem[]): void {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(this.buildMGH100InternoHtml(nro, fv, items));
        w.document.close();
        w.focus();
    }

    private abrirImpresionPrestamoExterno(nro: string, fv: any, items: ExternalLoanItem[]): void {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(this.buildMGH100ExternoHtml(nro, fv, items));
        w.document.close();
        w.focus();
    }

    private buildMGH100InternoHtml(nro: string, fv: any, items: InternalLoanItem[]): string {
        const now  = new Date().toLocaleString('es-BO');
        const rows = items.map(item => `<tr><td>${item.codigo || '-'}</td><td>${item.pn || '-'}</td><td>${item.sn || '-'}</td><td style="text-align:center;font-weight:700">${item.cantidad}</td><td style="text-align:center">${item.unidad || 'PZA'}</td><td>${item.descripcion || '-'}</td><td>${item.contenido || '-'}</td><td>${item.fechaCalibracion || '-'}</td><td>${item.estado || 'SERVICEABLE'}</td><td>&nbsp;</td></tr>`).join('');
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MGH-100 Nota de Préstamo ${nro}</title>${this.sharedPdfStyles()}</head><body>${this.pdfTopBar('OAM145# N-114', 'MGH-100', '2016-10-13')}<h1>NOTA DE PRÉSTAMO - DEVOLUCIÓN<br><span style="font-size:10px;font-weight:400">HERRAMIENTAS, BANCOS DE PRUEBA Y EQUIPOS DE APOYO</span></h1><table class="info-tbl"><tr><td class="lbl">NOMBRE SOLICITANTE:</td><td>${fv.nombreCompleto || ''}</td><td class="lbl">UNIDAD DESTINO:</td><td>${fv.destino || ''}</td><td class="nro-cell" rowspan="4"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro || '___________'}</td></tr><tr><td class="lbl">LICENCIA:</td><td>${fv.nroLicencia || ''}</td><td class="lbl">ORDEN DE TRABAJO:</td><td>${fv.ordenTrabajo || ''}</td></tr><tr><td class="lbl">MATRÍCULA AERONAVE:</td><td>${fv.matriculaAeronave || ''}</td><td class="lbl">TRABAJO ESPECIAL:</td><td>${fv.trabajoEspecial ? 'SÍ' : 'NO'}</td></tr><tr><td class="lbl">FECHA Y HORA:</td><td>${fv.fecha || ''} ${fv.hora || ''}</td><td class="lbl">OBSERVACIONES:</td><td>${fv.observaciones || ''}</td></tr></table><div class="sec">DATOS PRÉSTAMO</div><table class="det"><thead><tr><th>CÓDIGO</th><th>P/N ó MODELO</th><th>S/N</th><th>CANT.</th><th>UND</th><th>DESCRIPCIÓN</th><th>LISTA CONTENIDO</th><th>FECHA CALIBRACIÓN</th><th>ESTADO</th><th>OBS</th></tr></thead><tbody>${rows}</tbody></table><div class="sec" style="margin-top:6px">DATOS DEVOLUCIÓN</div><table class="det"><thead><tr><th>FECHA / HORA</th><th colspan="2">ENTREGUE CONFORME (NOMBRE / FIRMA)</th><th colspan="2">RECIBI CONFORME (NOMBRE / FIRMA)</th><th>CONDICIÓN DEVOLUCIÓN</th><th>NRO. REPORTE AVERÍA</th><th>OBS</th></tr></thead><tbody>${items.map(() => `<tr><td style="height:28px">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')}</tbody></table>${this.notaImportantePrestamo()}${this.firmasPrestamo(fv.nombreCompleto || '')}<div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div><script>window.onload=function(){setTimeout(function(){window.print();},500);};</script></body></html>`;
    }

    private buildMGH100ExternoHtml(nro: string, fv: any, items: ExternalLoanItem[]): string {
        const now   = new Date().toLocaleString('es-BO');
        const total = items.reduce((s, i) => s + (i.precioTotal || 0), 0);
        const rows  = items.map(item => `<tr><td>${item.codigo || '-'}</td><td>${item.pn || '-'}</td><td>${item.sn || '-'}</td><td style="text-align:center;font-weight:700">${item.cantidad}</td><td>${item.descripcion || '-'}</td><td>${item.contenido || '-'}</td><td style="text-align:right">${item.costoHora ? '$' + item.costoHora.toFixed(2) : '-'}</td><td style="text-align:right">${item.precioTotal ? '$' + item.precioTotal.toFixed(2) : '-'}</td><td>&nbsp;</td></tr>`).join('');
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MGH-100 Nota de Préstamo Terceros ${nro}</title>${this.sharedPdfStyles()}</head><body>${this.pdfTopBar('OAM145# N-114', 'MGH-100', '2016-10-13')}<h1>NOTA DE PRÉSTAMO - DEVOLUCIÓN A TERCEROS</h1><table class="info-tbl"><tr><td class="lbl">NOMBRE SOLICITANTE:</td><td>${fv.nombreEmpresa || ''}</td><td class="lbl">EMPRESA:</td><td>${fv.empresaSeleccionada || ''}</td><td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro || '___________'}</td></tr><tr><td class="lbl">CONTACTO:</td><td>${fv.contacto || ''}</td><td class="lbl">PRECIO $US:</td><td style="font-weight:700">$${total.toFixed(2)}</td></tr><tr><td class="lbl">FECHA Y HORA:</td><td>${fv.fecha || ''} ${fv.hora || ''}</td><td class="lbl">OBSERVACIONES:</td><td>${fv.observaciones || ''}</td></tr></table><div class="sec">DATOS PRÉSTAMO</div><table class="det"><thead><tr><th>CÓDIGO</th><th>P/N ó MODELO</th><th>S/N</th><th>CANT.</th><th>DESCRIPCIÓN</th><th>LISTA CONTENIDO</th><th>HR. $</th><th>VALOR $</th><th>OBS</th></tr></thead><tbody>${rows}</tbody></table><div class="sec" style="margin-top:6px">DATOS DEVOLUCIÓN</div><table class="det"><thead><tr><th>FECHA / HORA</th><th colspan="2">ENTREGUE CONFORME (NOMBRE / FIRMA)</th><th colspan="2">RECIBI CONFORME (NOMBRE / FIRMA)</th><th>CONDICIÓN DEVOLUCIÓN</th><th>NRO. REPORTE AVERÍA</th><th>OBS</th></tr></thead><tbody>${items.map(() => `<tr><td style="height:28px">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')}</tbody></table>${this.notaImportantePrestamo()}<div class="sigs"><div class="sig"><div class="sig-ttl">ENTREGADO POR<br>FIRMA ALMACÉN</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">RECIBIDO POR</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">AUTORIZADO POR<br>FIRMA AUTORIZADA BOA</div><div class="sig-line">&nbsp;</div></div></div><div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div><script>window.onload=function(){setTimeout(function(){window.print();},500);};</script></body></html>`;
    }

    private sharedPdfStyles(): string {
        return `<style>@page { size: A4 landscape; margin: 12mm 10mm; } * { box-sizing: border-box; } body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; } .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; } .code-box { border: 2px solid #000; padding: 3px 10px; font-weight: 900; font-size: 13px; display: inline-block; } h1 { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; background: #111A43; color: white; padding: 7px 10px; margin: 0 0 7px; border: 1px solid #000; } .info-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 7px; } .info-tbl td { border: 1px solid #ddd; padding: 3px 6px; } .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 130px; } .nro-cell { background: #f0f0f0; text-align: center; font-weight: 900; font-size: 15px; vertical-align: middle; width: 120px; } .sec { background: #111A43; color: white; padding: 3px 8px; font-weight: 900; font-size: 10px; text-transform: uppercase; border: 1px solid #000; margin-bottom: 0; } table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; } table.det th { background: #111A43; color: white; padding: 5px 4px; font-size: 8.5px; font-weight: 900; text-transform: uppercase; border: 1px solid #000; text-align: center; } table.det td { padding: 4px; border: 1px solid #ddd; font-size: 9px; } table.det tr:nth-child(even) td { background: #f9f9f9; } .nota { border: 1px solid #ccc; padding: 5px 8px; margin-top: 8px; font-size: 8.5px; background: #fffde7; line-height: 1.5; } .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; } .sig { border: 1px solid #000; padding: 6px 8px; text-align: center; } .sig-ttl { font-weight: 900; font-size: 9px; text-transform: uppercase; margin-bottom: 26px; line-height: 1.4; } .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 8.5px; } .footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style>`;
    }

    private pdfTopBar(org: string, code: string, date: string): string { return `<div class="top"><div style="font-weight:900;font-size:11px">BoAMM &nbsp; ${org}</div><div style="text-align:right"><div class="code-box">${code}</div><br><span style="font-size:9px">REV. 0 &nbsp; ${date}</span></div></div>`; }
    private notaImportantePrestamo(): string { return `<div class="nota"><strong>NOTA IMPORTANTE:</strong><br>- Para cada herramienta prestada, se encuentra detallada la condición en la que se esta prestando en la casilla correspondiente.<br>- Las herramientas deben devolverse en las mismas condiciones en las que fueron prestadas.<br>- En caso de avería, registrar en el formulario REPORTE DE DISCREPANCIA. La firma implica conformidad con la información.</div>`; }
    private firmasPrestamo(nombre: string): string { return `<div class="sigs"><div class="sig"><div class="sig-ttl">ENTREGADO POR<br>FIRMA ALMACÉN HERRAMIENTAS</div><div style="font-size:9px;margin-bottom:20px">${nombre}</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">RECIBIDO POR<br>FIRMA TÉC. O INSP.</div><div class="sig-line">&nbsp;</div></div><div class="sig"><div class="sig-ttl">AUTORIZADO</div><div class="sig-line">&nbsp;</div></div></div>`; }

    // ── UTILIDADES DE VALIDACIÓN (Para el HTML) ──────────────────────────────
    hasErrorInternal(field: string, error: string): boolean {
        const control = this.internalForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    hasErrorExternal(field: string, error: string): boolean {
        const control = this.externalForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }
}
