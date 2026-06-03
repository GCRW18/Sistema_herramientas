import { Component, OnInit, OnDestroy, signal, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, catchError, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { MovementService } from '../../../../core/services/movement.service';

interface Proveedor {
    id: string;
    nombre: string;
    nit?: string;
    direccion?: string;
    telefono?: string;
}

interface HerramientaItem {
    pn: string;
    sn: string;
    descripcion: string;
    codigoBoa: string;
    cantidad: number;
    unidadMedida: string;
    estado: string;
    costoHora: number;
    costoServicio: number;
    estante: string;
    nivelUbicacion: string;
    accesorios: string;
    documento: string;
    observacion: string;
    requiereCalibracion: boolean;
    intervaloCalibracion: number | null;
    fechaCalibracion: string | null;
    nroCertificado: string;
    tipo: string;
    marca: string;
    nivelCriticidad: string;
    fabricacion: string;
}

interface AjusteItem {
    id: number;
    toolId: number;
    pn: string;
    descripcion: string;
    marca: string;
    sn: string;
    codigoBoa: string;
    cantidad: number;
    um: string;
    estado: string;
    ubicacion: string;
    tipoAjuste: string;
    documentos: string;
    obs: string;
    selected?: boolean;
}

type TabType = 'nueva' | 'ajuste';

@Component({
    selector: 'app-ingresos-hub',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatIconModule, MatTableModule, MatCheckboxModule,
        MatDialogModule, MatSnackBarModule, MatProgressSpinnerModule,
        MatTooltipModule, MatAutocompleteModule, MatSlideToggleModule, DragDropModule
    ],
    templateUrl: './ingresos-hub.component.html',
    styles: [`
        :host { display: flex; flex-direction: column; height: 100%; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
        [hidden] { display: none !important; }
        .row-nueva-selected { background-color: #dcfce7 !important; }
        .row-ajuste-selected { background-color: #fef3c7 !important; }
        :host-context(.dark) .row-nueva-selected { background-color: rgba(21,128,61,0.15) !important; }
        :host-context(.dark) .row-ajuste-selected { background-color: rgba(251,191,36,0.2) !important; }
        .spinner-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999;
        }
        :host-context(.dark) .spinner-overlay { background: rgba(15,23,42,0.85); }
        @keyframes pulse-border { 0%,100% { border-color:#ef4444; } 50% { border-color:#f87171; } }
        .animate-pulse-border { animation: pulse-border 2s cubic-bezier(.4,0,.6,1) infinite; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
    `]
})
export class IngresosHubComponent implements OnInit, OnDestroy {

    @ViewChild('recepcionModal')    recepcionModal!:    TemplateRef<any>;
    @ViewChild('herramientaModal')  herramientaModal!:  TemplateRef<any>;
    @ViewChild('confirmNuevaModal') confirmNuevaModal!: TemplateRef<any>;
    @ViewChild('datosAjusteModal')  datosAjusteModal!:  TemplateRef<any>;
    @ViewChild('confirmAjusteModal') confirmAjusteModal!: TemplateRef<any>;

    public  dialogRefComponent = inject(MatDialogRef<IngresosHubComponent>, { optional: true });
    private dialogRefActual: MatDialogRef<any> | null = null;
    private dialog      = inject(MatDialog);
    private fb          = inject(FormBuilder);
    private router      = inject(Router);
    private snackBar    = inject(MatSnackBar);
    private movementSvc = inject(MovementService);
    private destroy$    = new Subject<void>();

    // ── Tab state ──────────────────────────────────────────────────────────────
    activeTab = signal<TabType>('nueva');
    setTab(tab: TabType): void { this.activeTab.set(tab); }

    // ══════════════════════════════════════════════════════════════════════════
    //  NUEVA HERRAMIENTA
    // ══════════════════════════════════════════════════════════════════════════
    recepcionForm!: FormGroup;
    herramientaForm!: FormGroup;
    dataSource: HerramientaItem[] = [];
    isSaving      = false;
    editingIndex: number | null = null;

    _funcSearch$  = new Subject<string>();
    funcFiltrados: { id: string; nombre: string; cargo: string }[] = [];
    funcLoading   = false;
    showFuncDropdown = false;

    proveedores:         Proveedor[] = [];
    proveedoresFiltrados: Proveedor[] = [];
    marcas:         string[] = [];
    marcasFiltradas: string[] = [];
    private ultimoCorrelativo = 0;

    unidadesMedida = [
        { value: 'UNIDAD', label: 'UNIDAD' }, { value: 'PAR',   label: 'PAR'   },
        { value: 'JUEGO',  label: 'JUEGO'  }, { value: 'KIT',   label: 'KIT'   },
        { value: 'LITRO',  label: 'LITRO'  }, { value: 'METRO', label: 'METRO' }
    ];

    estadosNueva = [
        { value: 'NUEVO',          label: 'NUEVO'          },
        { value: 'REACONDICIONADO', label: 'REACONDICIONADO' },
        { value: 'USADO',           label: 'USADO'           }
    ];

    tiposHerramienta = [
        { value: 'HERRAMIENTA',    label: 'HERRAMIENTA'                  },
        { value: 'BANCO_PRUEBA',   label: 'BANCO DE PRUEBA'              },
        { value: 'CONSUMIBLE',     label: 'CONSUMIBLE'                   },
        { value: 'EQUIPO_MEDICION', label: 'EQUIPO DE MEDICIÓN'          },
        { value: 'EQUIPO_SOPORTE',  label: 'EQUIPO DE SOPORTE EN TIERRA' }
    ];

    nivelesCriticidad = [
        { value: 'A', label: 'A - Crítico', descripcion: 'Herramienta esencial para operaciones' },
        { value: 'B', label: 'B - Normal',  descripcion: 'Herramienta de uso regular'            }
    ];

    tiposFabricacion = [
        { value: 'INTERNACIONAL', label: 'INTERNACIONAL' },
        { value: 'LOCAL',         label: 'LOCAL'         }
    ];

    // ══════════════════════════════════════════════════════════════════════════
    //  AJUSTE INGRESO
    // ══════════════════════════════════════════════════════════════════════════
    ajusteForm!: FormGroup;
    dataSourceAjuste: AjusteItem[] = [];
    isSavingAjuste = false;
    itemIdCounter  = 1;

    _realizadoPorSearch$ = new Subject<string>();
    realizadoPorFiltrados: { id: string; nombre: string; cargo: string }[] = [];
    realizadoPorLoading   = false;
    showRealizadoPorDropdown = false;

    _aprobadoPorSearch$ = new Subject<string>();
    aprobadoPorFiltrados: { id: string; nombre: string; cargo: string }[] = [];
    aprobadoPorLoading   = false;
    showAprobadoPorDropdown = false;

    displayedColumnsAjuste = ['select','fila','identificacion','descripcion','cantEstado','ubicacion','tipoAjuste','acciones'];

    tiposAjuste = [
        { value: 'INVENTARIO',  label: 'Ajuste Inventario',  color: 'bg-blue-100 text-blue-800 border-blue-400',      icon: 'inventory_2'   },
        { value: 'REUBICACION', label: 'Reubicación',        color: 'bg-purple-100 text-purple-800 border-purple-400', icon: 'swap_horiz'    },
        { value: 'DONACION',    label: 'Donación Recibida',  color: 'bg-green-100 text-green-800 border-green-400',    icon: 'card_giftcard' },
        { value: 'ENCONTRADO',  label: 'Item Encontrado',    color: 'bg-amber-100 text-amber-800 border-amber-400',    icon: 'search'        },
        { value: 'SOBRANTE',    label: 'Sobrante',           color: 'bg-cyan-100 text-cyan-800 border-cyan-400',       icon: 'add_box'       },
        { value: 'CORRECCION',  label: 'Corrección Sistema', color: 'bg-red-100 text-red-800 border-red-400',          icon: 'build'         }
    ];

    estadosAjuste = [
        { value: 'SERVICEABLE',    label: 'Serviceable',    color: 'bg-green-100 text-green-800 border-green-400'   },
        { value: 'UNSERVICEABLE',  label: 'Unserviceable',  color: 'bg-red-100 text-red-800 border-red-400'         },
        { value: 'EN_CALIBRACION', label: 'En Calibración', color: 'bg-yellow-100 text-yellow-800 border-yellow-400' },
        { value: 'REPARACION',     label: 'En Reparación',  color: 'bg-orange-100 text-orange-800 border-orange-400' },
        { value: 'NUEVO',          label: 'Nuevo',          color: 'bg-blue-100 text-blue-800 border-blue-400'      }
    ];

    // ══════════════════════════════════════════════════════════════════════════
    //  LIFECYCLE
    // ══════════════════════════════════════════════════════════════════════════
    ngOnInit(): void {
        this._initFormsNueva();
        this._setupFuncionarioSearch();
        this._loadInitialData();
        this._initFormAjuste();
        this._setupRealizadoPorSearch();
        this._setupAprobadoPorSearch();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  NUEVA HERRAMIENTA — FORMS
    // ══════════════════════════════════════════════════════════════════════════
    private _initFormsNueva(): void {
        this.recepcionForm = this.fb.group({
            tipoDe:           ['COMPRA', Validators.required],
            nroCmr:           ['', [Validators.required, Validators.minLength(3)]],
            nroFactura:       [''],
            proveedor:        [''],
            fechaIngreso:     [new Date().toISOString().split('T')[0], Validators.required],
            funcionarioRecibe: ['', Validators.required],
            recibiConforme:   [''],
            ordenCompra:      [''],
            observaciones:    ['']
        });

        this.herramientaForm = this.fb.group({
            pn:                   ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z0-9\-_]+$/)]],
            sn:                   ['', Validators.pattern(/^[A-Za-z0-9\-_]*$/)],
            descripcion:          ['', [Validators.required, Validators.minLength(3)]],
            codigoBoa:            ['BOA-H-', [Validators.required, Validators.pattern(/^[A-Za-z0-9\-]+$/)]],
            cantidad:             [1, [Validators.required, Validators.min(1), Validators.max(9999)]],
            unidadMedida:         ['UNIDAD', Validators.required],
            estado:               ['NUEVO', Validators.required],
            estante:              [''],
            nivelUbicacion:       [''],
            accesorios:           [''],
            documento:            [''],
            observacion:          [''],
            requiereCalibracion:  [false],
            intervaloCalibracion: [null],
            fechaCalibracion:     [null],
            nroCertificado:       [''],
            tipo:                 ['HERRAMIENTA', Validators.required],
            marca:                ['', Validators.required],
            nivelCriticidad:      ['B', Validators.required],
            fabricacion:          ['INTERNACIONAL', Validators.required]
        });

        this.recepcionForm.get('proveedor')?.valueChanges.pipe(
            takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged()
        ).subscribe(v => this._filtrarProveedores(v));

        this.herramientaForm.get('marca')?.valueChanges.pipe(
            takeUntil(this.destroy$), debounceTime(200), distinctUntilChanged()
        ).subscribe(v => this._filtrarMarcas(v));

        this.herramientaForm.get('requiereCalibracion')?.valueChanges.pipe(
            takeUntil(this.destroy$)
        ).subscribe(requiere => {
            const ctrl = this.herramientaForm.get('intervaloCalibracion');
            if (requiere) {
                ctrl?.setValidators([Validators.required, Validators.min(1)]);
            } else {
                ctrl?.clearValidators();
                this.herramientaForm.patchValue({ intervaloCalibracion: null, fechaCalibracion: null, nroCertificado: '' });
            }
            ctrl?.updateValueAndValidity();
        });
    }

    private _setupFuncionarioSearch(): void {
        this._funcSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showFuncDropdown = false; return of([]); }
                this.funcLoading = true;
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({
                            id:     String(f.id_employee || f.id),
                            nombre: f.nombreCompleto || `${f.nombre || ''} ${f.apellido_paterno || ''}`.trim(),
                            cargo:  f.cargo || ''
                        }))
                    ),
                    finalize(() => this.funcLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => {
            this.funcFiltrados = res || [];
            this.showFuncDropdown = this.funcFiltrados.length > 0;
        });
    }

    private _loadInitialData(): void {
        this.movementSvc.getProveedores().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (data: any[]) => {
                this.proveedores = data.map(p => ({
                    id: p.id, nombre: p.nombre || p.name, nit: p.nit, direccion: p.direccion, telefono: p.telefono
                }));
                this.proveedoresFiltrados = [...this.proveedores];
            }});

        this.movementSvc.getDistinctBrands().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (brands: string[]) => { this.marcas = brands; this.marcasFiltradas = [...brands]; } });

        this.movementSvc.getLastBoaCode().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (num: number) => { this.ultimoCorrelativo = num; } });
    }

    // ── Nueva: modal handlers ─────────────────────────────────────────────────
    abrirModalRecepcion(): void {
        this.dialogRefActual = this.dialog.open(this.recepcionModal, {
            width: '700px', maxWidth: '95vw', height: '88vh', panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    cerrarModalRecepcion(): void { this.dialogRefActual?.close(); }

    abrirModalHerramienta(index?: number): void {
        if (index !== undefined) {
            this.editingIndex = index;
            this.herramientaForm.patchValue({ ...this.dataSource[index] });
        } else {
            this.editingIndex = null;
            this._resetHerramientaForm();
        }
        this.dialogRefActual = this.dialog.open(this.herramientaModal, {
            width: '900px', maxWidth: '95vw', height: '88vh', panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    cerrarModalHerramienta(): void { this.editingIndex = null; this.dialogRefActual?.close(); }

    abrirModalConfirmacionNueva(): void {
        const validation = this.validateRecepcion();
        if (!validation.valid) {
            validation.errors.forEach(err => this._showMsg(err, 'error'));
            this.abrirModalRecepcion();
            return;
        }
        if (this.dataSource.length === 0) {
            this._showMsg('Agregue al menos una herramienta a la lista', 'warning');
            return;
        }
        this.dialogRefActual = this.dialog.open(this.confirmNuevaModal, {
            width: '700px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalConfirmacionNueva(): void { this.dialogRefActual?.close(); }

    // ── Nueva: table actions ──────────────────────────────────────────────────
    agregarHerramienta(): void {
        this.herramientaForm.markAllAsTouched();
        if (this.herramientaForm.invalid) {
            this._showMsg('Complete los campos requeridos', 'error');
            return;
        }
        const f = this.herramientaForm.value;
        const existeIndex = this.dataSource.findIndex(
            i => i.codigoBoa.toUpperCase() === f.codigoBoa.toUpperCase()
        );
        if (existeIndex >= 0 && this.editingIndex !== existeIndex) {
            this._showMsg('Ya existe una herramienta con este código BOA', 'warning');
            return;
        }
        const item: HerramientaItem = {
            ...f,
            pn:                   f.pn.toUpperCase(),
            codigoBoa:            f.codigoBoa.toUpperCase(),
            costoHora:            0,
            costoServicio:        0,
            intervaloCalibracion: f.requiereCalibracion ? f.intervaloCalibracion : null,
            fechaCalibracion:     f.requiereCalibracion ? f.fechaCalibracion     : null,
            nroCertificado:       f.requiereCalibracion ? f.nroCertificado       : ''
        };
        if (this.editingIndex !== null) {
            this.dataSource[this.editingIndex] = item;
            this._showMsg('Herramienta actualizada en la recepción', 'success');
        } else {
            this.dataSource.push(item);
            this._showMsg('Herramienta añadida a la recepción', 'success');
        }
        this.dataSource = [...this.dataSource];
        this.cerrarModalHerramienta();
    }

    eliminarItemNueva(index: number): void {
        if (confirm(`¿Eliminar ${this.dataSource[index].pn} de la lista?`)) {
            this.dataSource.splice(index, 1);
            this.dataSource = [...this.dataSource];
        }
    }

    duplicarItem(index: number): void {
        const copy = { ...this.dataSource[index] };
        copy.sn = '';
        this.ultimoCorrelativo++;
        copy.codigoBoa = `BOA-H-${this.ultimoCorrelativo.toString().padStart(4, '0')}`;
        this.editingIndex = null;
        this.herramientaForm.patchValue(copy);
        this.dialogRefActual = this.dialog.open(this.herramientaModal, {
            width: '900px', maxWidth: '95vw', height: '88vh', panelClass: 'no-padding-dialog', disableClose: true
        });
        this._showMsg('Ítem copiado. Ajuste el S/N si es necesario.', 'info');
    }

    // ── Nueva: finalize ───────────────────────────────────────────────────────
    finalizarIngreso(): void {
        this.cerrarModalConfirmacionNueva();
        this.isSaving = true;
        const rec = this.recepcionForm.value;
        const prov = rec.proveedor;
        const provNombre = typeof prov === 'object' ? prov?.nombre : prov || '';
        const itemsJson = JSON.stringify(this.dataSource.map(h => ({
            code: h.codigoBoa, name: h.descripcion, description: h.descripcion,
            brand: h.marca || '', part_number: h.pn || '', serial_number: h.sn || '',
            quantity: h.cantidad, purchase_price: 0, rental_cost_service: 0,
            shelf: h.estante || '', shelf_level: h.nivelUbicacion || '', accessories: h.accesorios || '',
            document_ref: h.documento || '', unit_of_measure: h.unidadMedida || 'UNIDAD',
            condition: h.estado === 'NUEVO' ? 'new' : h.estado === 'REACONDICIONADO' ? 'fair' : 'good',
            criticality_level: h.nivelCriticidad || 'B', manufacture_origin: h.fabricacion || 'INTERNACIONAL',
            requires_calibration: h.requiereCalibracion || false, calibration_interval: h.intervaloCalibracion || null,
            calibration_date: h.fechaCalibracion || null, certificate_number: h.nroCertificado || '', notes: h.observacion || ''
        })));
        this.movementSvc.registrarNuevaCompra({
            movement_number:    rec.nroCmr,
            date:               rec.fechaIngreso,
            responsible_person: rec.funcionarioRecibe || '',
            received_by_name:   rec.recibiConforme   || '',
            supplier:           provNombre,
            invoice_number:     rec.nroFactura       || '',
            purchase_order:     rec.ordenCompra      || '',
            notes:              rec.observaciones    || '',
            warehouse_id: 1,
            items_json: itemsJson
        }).pipe(takeUntil(this.destroy$), finalize(() => this.isSaving = false))
            .subscribe({
                next: (resp: any) => {
                    this._showMsg(`Recepción registrada: ${resp?.movement_number}`, 'success');
                    if (this.dialogRefComponent) this.dialogRefComponent.close({ success: true });
                    else this.router.navigate(['/entradas']);
                },
                error: (err: any) => this._showMsg(err?.message || 'Error al registrar', 'error')
            });
    }

    async openCatalogo(): Promise<void> {
        const { HerramientasAIngresarComponent } = await import('./herramientas-a-ingresar/herramientas-a-ingresar.component');
        const ref = this.dialog.open(HerramientasAIngresarComponent, {
            width: '760px', maxWidth: '95vw', height: '88vh',
            panelClass: 'no-padding-dialog'
        });
        ref.afterClosed().subscribe((result: any) => {
            if (result?.action !== 'procesar') return;
            const data = result.data;
            const existe = this.dataSource.some(i => i.codigoBoa.toUpperCase() === (data.codigo || '').toUpperCase());
            if (existe) { this._showMsg('Esta herramienta ya está en la recepción', 'warning'); return; }
            this.dataSource.push({
                pn: data.pn || '', sn: data.sn || '', descripcion: data.nombre || data.descripcion || '',
                codigoBoa: data.codigo || '', cantidad: data.cantidad || 1, unidadMedida: data.um || data.unidadMedida || 'UNIDAD',
                estado: data.estado || 'NUEVO', costoHora: 0, costoServicio: 0, estante: '', nivelUbicacion: '',
                accesorios: '', documento: data.documento || '', observacion: data.observaciones || '',
                requiereCalibracion: false, intervaloCalibracion: null, fechaCalibracion: null, nroCertificado: '',
                tipo: 'HERRAMIENTA', marca: '', nivelCriticidad: 'B', fabricacion: 'INTERNACIONAL'
            });
            this.dataSource = [...this.dataSource];
            this._showMsg('Añadido desde catálogo. Complete detalles como Nro. Serie o Estante.', 'success');
        });
    }

    // ── Nueva: utilities ──────────────────────────────────────────────────────
    onFuncionarioInput(val: string): void {
        this.recepcionForm.patchValue({ funcionarioRecibe: val });
        this._funcSearch$.next(val);
    }

    selectFuncionario(f: { id: string; nombre: string; cargo: string }): void {
        this.recepcionForm.patchValue({ funcionarioRecibe: f.nombre });
        this.showFuncDropdown = false;
    }

    hideFuncDropdown(): void { setTimeout(() => this.showFuncDropdown = false, 150); }

    isRecepcionValida(): boolean { return this.recepcionForm.valid; }

    validateRecepcion(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        this.recepcionForm.markAllAsTouched();
        if (this.recepcionForm.get('nroCmr')?.invalid)         errors.push('Falta Nro Documento/CMR');
        if (this.recepcionForm.get('fechaIngreso')?.invalid)   errors.push('Falta Fecha de Recepción');
        if (!this.recepcionForm.get('funcionarioRecibe')?.value) errors.push('Falta Funcionario que Recibe');
        return { valid: errors.length === 0, errors };
    }

    generarCodigoBoa(): void {
        this.ultimoCorrelativo++;
        this.herramientaForm.patchValue({ codigoBoa: `BOA-H-${this.ultimoCorrelativo.toString().padStart(4, '0')}` });
    }

    getTotalItems(): number { return this.dataSource.reduce((sum, i) => sum + i.cantidad, 0); }

    getEstadoNuevaClass(estado: string): string {
        switch (estado) {
            case 'NUEVO':           return 'bg-green-100 text-green-800 border-green-300';
            case 'REACONDICIONADO': return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'USADO':           return 'bg-amber-100 text-amber-800 border-amber-300';
            default:                return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    }

    displayProveedor(p: Proveedor): string {
        return p ? `${p.nombre}${p.nit ? ' (' + p.nit + ')' : ''}` : '';
    }

    hasRecepcionError(field: string, error: string): boolean {
        const c = this.recepcionForm.get(field);
        return !!(c?.hasError(error) && c?.touched);
    }

    hasHerramientaError(field: string, error: string): boolean {
        const c = this.herramientaForm.get(field);
        return !!(c?.hasError(error) && c?.touched);
    }

    private _resetHerramientaForm(): void {
        this.herramientaForm.reset({
            codigoBoa: 'BOA-H-', cantidad: 1, unidadMedida: 'UNIDAD', estado: 'NUEVO',
            requiereCalibracion: false, tipo: 'HERRAMIENTA', nivelCriticidad: 'B', fabricacion: 'INTERNACIONAL'
        });
    }

    private _filtrarProveedores(v: string): void {
        this.proveedoresFiltrados = v
            ? this.proveedores.filter(p => p.nombre.toLowerCase().includes(v.toLowerCase()) || (p.nit && p.nit.includes(v.toLowerCase())))
            : [...this.proveedores];
    }

    private _filtrarMarcas(v: string): void {
        this.marcasFiltradas = v
            ? this.marcas.filter(m => m.toLowerCase().includes(v.toLowerCase()))
            : [...this.marcas];
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  AJUSTE INGRESO — FORMS
    // ══════════════════════════════════════════════════════════════════════════
    private _initFormAjuste(): void {
        this.ajusteForm = this.fb.group({
            realizadoPor:      ['', Validators.required],
            realizadoPorInput: [''],
            aprobadoPor:       ['', Validators.required],
            aprobadoPorInput:  [''],
            tipoAjuste:        ['INVENTARIO', Validators.required],
            documento:         [''],
            fecha:             [new Date().toISOString().split('T')[0], Validators.required],
            descripcion:       ['']
        });
    }

    private _setupRealizadoPorSearch(): void {
        this._realizadoPorSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showRealizadoPorDropdown = false; return of([]); }
                this.realizadoPorLoading = true;
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({
                            id:     String(f.id_employee || f.id),
                            nombre: f.nombreCompleto || `${f.nombre || ''} ${f.apellido_paterno || ''}`.trim(),
                            cargo:  f.cargo || ''
                        }))
                    ),
                    finalize(() => this.realizadoPorLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => {
            this.realizadoPorFiltrados = res || [];
            this.showRealizadoPorDropdown = this.realizadoPorFiltrados.length > 0;
        });
    }

    private _setupAprobadoPorSearch(): void {
        this._aprobadoPorSearch$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { this.showAprobadoPorDropdown = false; return of([]); }
                this.aprobadoPorLoading = true;
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({
                            id:     String(f.id_employee || f.id),
                            nombre: f.nombreCompleto || `${f.nombre || ''} ${f.apellido_paterno || ''}`.trim(),
                            cargo:  f.cargo || ''
                        }))
                    ),
                    finalize(() => this.aprobadoPorLoading = false),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => {
            this.aprobadoPorFiltrados = res || [];
            this.showAprobadoPorDropdown = this.aprobadoPorFiltrados.length > 0;
        });
    }

    // ── Ajuste: modal handlers ────────────────────────────────────────────────
    abrirModalDatosAjuste(): void {
        this.dialogRefActual = this.dialog.open(this.datosAjusteModal, {
            width: '700px', maxWidth: '95vw', height: '88vh', panelClass: 'no-padding-dialog', disableClose: true
        });
    }

    cerrarModalDatosAjuste(): void { this.dialogRefActual?.close(); }

    isDatosAjusteValido(): boolean { return this.ajusteForm.valid; }

    abrirModalConfirmacionAjuste(): void {
        this.ajusteForm.markAllAsTouched();
        if (this.ajusteForm.invalid) {
            this._showMsg('Complete los datos generales del ajuste', 'error');
            this.abrirModalDatosAjuste();
            return;
        }
        if (this.dataSourceAjuste.length === 0) {
            this._showMsg('Agregue al menos una herramienta', 'warning');
            return;
        }
        this.dialogRefActual = this.dialog.open(this.confirmAjusteModal, {
            width: '800px', maxWidth: '95vw', panelClass: 'neo-dialog-transparent', disableClose: true
        });
    }

    cerrarModalConfirmacionAjuste(): void { this.dialogRefActual?.close(); }

    // ── Ajuste: table actions ─────────────────────────────────────────────────
    toggleSelectionAjuste(item: AjusteItem): void { item.selected = !item.selected; }

    toggleAllAjuste(event: any): void {
        const checked = event.checked;
        this.dataSourceAjuste.forEach(i => i.selected = checked);
    }

    isAllAjusteSelected(): boolean {
        return this.dataSourceAjuste.length > 0 && this.dataSourceAjuste.every(i => i.selected);
    }

    isSomeAjusteSelected(): boolean {
        return this.dataSourceAjuste.some(i => i.selected) && !this.isAllAjusteSelected();
    }

    getAjusteSelectedCount(): number { return this.dataSourceAjuste.filter(i => i.selected).length; }

    getTotalCantidadAjuste(): number { return this.dataSourceAjuste.reduce((s, i) => s + i.cantidad, 0); }

    getResumenPorTipo(): { [key: string]: number } {
        const resumen: { [key: string]: number } = {};
        this.dataSourceAjuste.forEach(i => { resumen[i.tipoAjuste] = (resumen[i.tipoAjuste] || 0) + 1; });
        return resumen;
    }

    getResumenPorTipoEntries(): { key: string; value: number }[] {
        const r = this.getResumenPorTipo();
        return Object.keys(r).map(k => ({ key: k, value: r[k] }));
    }

    removeItemAjuste(item: AjusteItem): void {
        if (confirm(`¿Está seguro de eliminar el item ${item.codigoBoa}?`)) {
            this.dataSourceAjuste = this.dataSourceAjuste.filter(i => i.id !== item.id);
            this._showMsg(`Item ${item.codigoBoa} eliminado`, 'info');
        }
    }

    editItemAjuste(item: AjusteItem): void { this.openDetalleHerramienta(item); }

    async openDetalleHerramienta(editItem?: AjusteItem): Promise<void> {
        const { DetalleHerramientaComponent } = await import('./detalle-herramienta/detalle-herramienta.component');
        const ref = this.dialog.open(DetalleHerramientaComponent, {
            width: '760px', maxWidth: '95vw', height: '88vh',
            panelClass: 'no-padding-dialog', hasBackdrop: true, disableClose: false, autoFocus: false,
            data: { tipoAjuste: this.ajusteForm.get('tipoAjuste')?.value, editItem }
        });
        ref.afterClosed().subscribe((result: any) => {
            if (result?.action !== 'procesar') return;
            if (editItem) {
                const idx = this.dataSourceAjuste.findIndex(i => i.id === editItem.id);
                if (idx !== -1) {
                    this.dataSourceAjuste[idx] = {
                        ...this.dataSourceAjuste[idx],
                        toolId:      result.data.toolId      || this.dataSourceAjuste[idx].toolId,
                        pn:          result.data.pn           || '',
                        descripcion: result.data.nombre       || '',
                        marca:       result.data.marca        || '',
                        sn:          result.data.sn           || '',
                        codigoBoa:   result.data.codigo       || '',
                        cantidad:    result.data.cantidad     || 1,
                        um:          result.data.um           || '',
                        estado:      result.data.estado       || '',
                        ubicacion:   result.data.ubicacion    || '',
                        tipoAjuste:  result.data.tipoAjuste   || this.ajusteForm.get('tipoAjuste')?.value,
                        documentos:  result.data.documento    || '',
                        obs:         result.data.observaciones || ''
                    };
                    this.dataSourceAjuste = [...this.dataSourceAjuste];
                    this._showMsg(`Item ${result.data.codigo} actualizado`, 'success');
                }
            } else {
                const newItem: AjusteItem = {
                    id:          this.itemIdCounter++,
                    toolId:      result.data.toolId      || 0,
                    pn:          result.data.pn           || '',
                    descripcion: result.data.nombre       || '',
                    marca:       result.data.marca        || '',
                    sn:          result.data.sn           || '',
                    codigoBoa:   result.data.codigo       || '',
                    cantidad:    result.data.cantidad     || 1,
                    um:          result.data.um           || '',
                    estado:      result.data.estado       || '',
                    ubicacion:   result.data.ubicacion    || '',
                    tipoAjuste:  result.data.tipoAjuste   || this.ajusteForm.get('tipoAjuste')?.value,
                    documentos:  result.data.documento    || '',
                    obs:         result.data.observaciones || '',
                    selected:    false
                };
                this.dataSourceAjuste = [...this.dataSourceAjuste, newItem];
                this._showMsg(`Item ${result.data.codigo} agregado`, 'success');
            }
        });
    }

    // ── Ajuste: finalize ──────────────────────────────────────────────────────
    finalizarAjuste(): void {
        const fv = this.ajusteForm.value;
        if (!fv.aprobadoPor) { this._showMsg('Debe seleccionar un aprobador', 'error'); return; }
        if (this.dataSourceAjuste.length === 0) { this._showMsg('No hay items', 'error'); return; }
        const sinId = this.dataSourceAjuste.filter(i => !i.toolId || isNaN(i.toolId));
        if (sinId.length > 0) {
            this._showMsg(`${sinId.length} herramienta(s) sin ID de sistema`, 'error');
            return;
        }
        this.cerrarModalConfirmacionAjuste();
        this.isSavingAjuste = true;
        const itemsJson = JSON.stringify(this.dataSourceAjuste.map(i => ({
            tool_id:  Number(i.toolId),
            quantity: i.cantidad,
            condicion: i.estado || 'SERVICEABLE',
            notes:    i.obs || ''
        })));
        this.movementSvc.registrarAjusteIngreso({
            date:               fv.fecha,
            time:               new Date().toTimeString().slice(0, 8),
            responsible_person: fv.realizadoPorInput || fv.realizadoPor,
            authorized_by:      fv.aprobadoPorInput  || fv.aprobadoPor,
            document_number:    fv.documento  || '',
            notes:              fv.descripcion || '',
            items_json:         itemsJson
        }).pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isSavingAjuste = false)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this._abrirImpresionAjuste(nro, this.dataSourceAjuste, fv);
                this._showMsg(`Ajuste registrado exitosamente: ${nro}`, 'success');
                this.dataSourceAjuste = [];
                this.ajusteForm.reset({ tipoAjuste: 'INVENTARIO', fecha: new Date().toISOString().split('T')[0] });
                if (this.dialogRefComponent) this.dialogRefComponent.close({ success: true, data: result });
            },
            error: (err: any) => this._showMsg('Error al registrar el ajuste: ' + (err?.message || ''), 'error')
        });
    }

    // ── Ajuste: utilities ─────────────────────────────────────────────────────
    onRealizadoPorInput(val: string): void {
        this.ajusteForm.patchValue({ realizadoPorInput: val });
        this._realizadoPorSearch$.next(val);
    }

    selectRealizadoPor(f: { id: string; nombre: string; cargo: string }): void {
        this.ajusteForm.patchValue({ realizadoPor: f.nombre, realizadoPorInput: f.nombre });
        this.showRealizadoPorDropdown = false;
    }

    hideRealizadoPorDropdown(): void { setTimeout(() => this.showRealizadoPorDropdown = false, 150); }

    onAprobadoPorInput(val: string): void {
        this.ajusteForm.patchValue({ aprobadoPorInput: val });
        this._aprobadoPorSearch$.next(val);
    }

    selectAprobador(f: { id: string; nombre: string; cargo: string }): void {
        this.ajusteForm.patchValue({ aprobadoPor: f.nombre, aprobadoPorInput: f.nombre });
        this.showAprobadoPorDropdown = false;
    }

    hideAprobadoPorDropdown(): void { setTimeout(() => this.showAprobadoPorDropdown = false, 150); }

    getRealizadoPorNombre(): string { return this.ajusteForm.value.realizadoPorInput || 'No seleccionado'; }
    getAprobadoPorNombre():  string { return this.ajusteForm.value.aprobadoPorInput  || 'No seleccionado'; }
    getDocumentoText():      string { return this.ajusteForm.value.documento || 'S/D'; }
    getFechaText():          string { return this.ajusteForm.value.fecha || ''; }

    getTipoAjusteClass(tipo: string): string {
        return this.tiposAjuste.find(t => t.value === tipo)?.color || 'bg-gray-100 text-gray-800 border-gray-400';
    }
    getTipoAjusteLabel(tipo: string): string {
        return this.tiposAjuste.find(t => t.value === tipo)?.label || tipo;
    }
    getEstadoAjusteClass(estado: string): string {
        return this.estadosAjuste.find(e => e.value === estado)?.color || 'bg-gray-100 text-gray-800 border-gray-400';
    }
    getEstadoAjusteLabel(estado: string): string {
        return this.estadosAjuste.find(e => e.value === estado)?.label || estado;
    }

    generarDocumento(): void {
        const tipo = this.ajusteForm.get('tipoAjuste')?.value;
        const prefijos: { [k: string]: string } = {
            'INVENTARIO': 'INV', 'REUBICACION': 'REUB', 'DONACION': 'DON',
            'ENCONTRADO': 'AJU', 'SOBRANTE': 'SOB',    'CORRECCION': 'CORR'
        };
        const prefijo = prefijos[tipo] || 'AJU';
        const year = new Date().getFullYear();
        const num  = Math.floor(Math.random() * 900) + 100;
        this.ajusteForm.patchValue({ documento: `${prefijo}-${year}-${num}` });
    }

    hasAjusteError(field: string, error: string): boolean {
        const c = this.ajusteForm.get(field);
        return !!(c?.hasError(error) && c?.touched);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  PDF — AJUSTE INGRESO
    // ══════════════════════════════════════════════════════════════════════════
    private _abrirImpresionAjuste(nro: string, items: AjusteItem[], fv: any): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const now = new Date().toLocaleString('es-BO');
        const rows = items.map((item, idx) => `
            <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td><span style="font-family:monospace;font-weight:700;background:#0f172a;color:white;padding:1px 5px;border-radius:3px;font-size:9px">${item.codigoBoa || '-'}</span></td>
                <td style="font-family:monospace;font-size:9px">${item.pn || '-'}</td>
                <td style="font-family:monospace;font-size:9px">${item.sn || '-'}</td>
                <td style="text-align:center;font-weight:700">${item.cantidad}</td>
                <td style="font-size:9px">${item.descripcion || '-'}</td>
                <td style="text-align:center"><span style="padding:2px 5px;border:1px solid #000;font-size:8px;font-weight:700">${item.estado || '-'}</span></td>
                <td style="font-size:8.5px">${item.documentos || '-'}</td>
                <td style="font-size:8.5px">${item.ubicacion || '-'}</td>
                <td style="font-size:8.5px">${item.obs || ''}</td>
            </tr>`).join('');
        const tipoLabel = this.getTipoAjusteLabel(fv.tipoAjuste || 'INVENTARIO');
        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Ajuste Ingreso ${nro}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
  .code-box { border: 2px solid #000; padding: 3px 10px; font-weight: 900; font-size: 13px; display: inline-block; }
  h1 { text-align: center; font-size: 12px; font-weight: 900; text-transform: uppercase;
       background: #111A43; color: white; padding: 7px 10px; margin: 0 0 7px; border: 1px solid #000; }
  .info-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 7px; }
  .info-tbl td { border: 1px solid #ddd; padding: 3px 6px; }
  .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 130px; }
  .nro-cell { background: #f0f0f0; text-align: center; font-weight: 900; font-size: 15px; vertical-align: middle; width: 120px; }
  .sec { background: #111A43; color: white; padding: 3px 8px; font-weight: 900; font-size: 10px;
         text-transform: uppercase; border: 1px solid #000; margin-bottom: 0; }
  table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.det th { background: #111A43; color: white; padding: 4px 3px; font-size: 8px; font-weight: 900;
                 text-transform: uppercase; border: 1px solid #000; text-align: center; }
  table.det td { padding: 3px 4px; border: 1px solid #ddd; font-size: 9px; }
  table.det tr:nth-child(even) td { background: #f9f9f9; }
  .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
  .sig { border: 1px solid #000; padding: 6px 8px; text-align: center; }
  .sig-ttl { font-weight: 900; font-size: 9px; text-transform: uppercase; margin-bottom: 26px; }
  .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 8.5px; }
  .footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
<script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); };</script>
</head><body>
  <div class="top">
    <div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145# N-114</div>
    <div style="text-align:right">
      <div class="code-box">API</div><br>
      <span style="font-size:9px">AJUSTE POR INGRESO</span>
    </div>
  </div>
  <h1>COMPROBANTE AJUSTE POR INGRESO<br>
    <span style="font-size:10px;font-weight:400">HERRAMIENTAS, BANCOS DE PRUEBA Y EQUIPOS DE APOYO</span>
  </h1>
  <table class="info-tbl">
    <tr>
      <td class="lbl">DOCUMENTO REF.:</td><td>${fv.documento || '—'}</td>
      <td class="lbl">TIPO AJUSTE:</td><td><strong>${tipoLabel}</strong></td>
      <td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° AJUSTE</div>${nro}</td>
    </tr>
    <tr>
      <td class="lbl">ELABORÓ AJUSTE:</td><td>${fv.realizadoPorInput || fv.realizadoPor || '—'}</td>
      <td class="lbl">AUTORIZÓ:</td><td>${fv.aprobadoPorInput || fv.aprobadoPor || '—'}</td>
    </tr>
    <tr>
      <td class="lbl">FECHA:</td><td>${fv.fecha || '—'}</td>
      <td class="lbl">OBSERVACIÓN:</td><td>${fv.descripcion || '—'}</td>
    </tr>
  </table>
  <div class="sec">DETALLE DE HERRAMIENTAS AJUSTADAS</div>
  <table class="det">
    <thead><tr>
      <th style="width:25px">ITEM</th><th>CÓDIGO BOA</th><th>P/N</th><th>S/N</th>
      <th style="width:35px">CANT.</th><th>DESCRIPCIÓN</th><th>ESTADO</th>
      <th>LISTA CONT.</th><th>UBICACIÓN</th><th>OBS</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sigs">
    <div class="sig">
      <div class="sig-ttl">ELABORÓ AJUSTE</div>
      <div style="font-size:9px;margin-bottom:16px">${fv.realizadoPorInput || fv.realizadoPor || '____________________'}</div>
      <div class="sig-line">Firma / Cargo</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">AUTORIZÓ</div>
      <div style="font-size:9px;margin-bottom:16px">${fv.aprobadoPorInput || fv.aprobadoPor || '____________________'}</div>
      <div class="sig-line">Firma / Cargo</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">RECIBIÓ ALMACÉN</div>
      <div class="sig-line">Firma Almacén Herramientas</div>
    </div>
  </div>
  <div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
</body></html>`;
        w.document.write(html);
        w.document.close();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  SHARED UTILITIES
    // ══════════════════════════════════════════════════════════════════════════
    private _showMsg(msg: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(msg, 'OK', { duration: 4000, horizontalPosition: 'end', verticalPosition: 'top', panelClass: [`snackbar-${type}`] });
    }
}
