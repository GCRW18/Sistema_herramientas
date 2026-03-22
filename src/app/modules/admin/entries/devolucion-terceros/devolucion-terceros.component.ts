import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';

interface Tercero {
    id: string;
    nit: string;
    razonSocial: string;
    nombreContacto: string;
    telefono: string;
    email: string;
    tipoEmpresa: string;
}

interface DevolucionTerceroItem {
    id: number;
    fila: number;
    toolId?: string;
    codigo: string;
    pn: string;
    descripcion: string;
    marca: string;
    fechaSalida: string;
    diasFuera: number;
    cantidad: number;
    nroNotaSalida: string;
    tipoContrato: string;
    proyecto: string;
    estado: string;
    condicionDevolucion: string;
    observaciones: string;
    selected?: boolean;
}

@Component({
    selector: 'app-devolucion-terceros',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTableModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatCheckboxModule,
        MatAutocompleteModule,
        MatTooltipModule,
        DragDropModule
    ],
    templateUrl: './devolucion-terceros.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }

        /* Forzar esquema oscuro para inputs nativos en modo dark */
        :host-context(.dark) {
            color-scheme: dark;
        }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base {
            background-color: #1e293b !important;
        }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        .spinner-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            border-radius: 8px;
        }

        :host-context(.dark) .spinner-overlay {
            background: rgba(15, 23, 42, 0.8);
        }

        .spinner-overlay-inline {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            border-radius: 8px;
        }

        :host-context(.dark) .spinner-overlay-inline {
            background: rgba(15, 23, 42, 0.8);
        }

        .row-selected {
            background-color: #fef3c7 !important;
        }

        :host-context(.dark) .row-selected {
            background-color: rgba(251, 191, 36, 0.2) !important;
        }
    `]
})
export class DevolucionTercerosComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<DevolucionTercerosComponent>, { optional: true });
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private _unsubscribeAll = new Subject<void>();

    devolucionForm!: FormGroup;

    isLoading = false;
    isSaving = false;
    isSearching = false;
    showConfirmModal = false;

    // Columnas para mat-table
    displayedColumns: string[] = [
        'select', 'fila', 'codigo', 'descripcion', 'tipoContrato',
        'fechaSalida', 'diasFuera', 'cantidad', 'proyecto', 'condicion', 'observaciones'
    ];

    terceros: Tercero[] = [
        { id: '1', nit: '1023456017', razonSocial: 'SAMCO S.R.L.', nombreContacto: 'Ing. Roberto Flores', telefono: '33445566', email: 'rflores@samco.com.bo', tipoEmpresa: 'CALIBRACION' },
        { id: '2', nit: '1034567028', razonSocial: 'AEROTEC BOLIVIA S.A.', nombreContacto: 'Lic. Carmen Vargas', telefono: '22334455', email: 'cvargas@aerotec.bo', tipoEmpresa: 'REPARACION' },
        { id: '3', nit: '1045678039', razonSocial: 'SERVITEC INDUSTRIAL', nombreContacto: 'Tec. Mario Condori', telefono: '77889900', email: 'mcondori@servitec.bo', tipoEmpresa: 'MANTENIMIENTO' },
        { id: '4', nit: '1056789040', razonSocial: 'METROLOGIA ANDINA S.R.L.', nombreContacto: 'Ing. Patricia Mamani', telefono: '66778899', email: 'pmamani@metroandina.com', tipoEmpresa: 'CALIBRACION' },
        { id: '5', nit: '1067890051', razonSocial: 'TALLER AERONAVAL LTDA.', nombreContacto: 'Cap. Juan Perez', telefono: '44556677', email: 'jperez@aeronaval.bo', tipoEmpresa: 'REPARACION' },
        { id: '6', nit: '1078901062', razonSocial: 'PRECISION TOOLS BOLIVIA', nombreContacto: 'Ing. Carlos Mendez', telefono: '55667788', email: 'cmendez@precisiontools.bo', tipoEmpresa: 'CALIBRACION' },
        { id: '7', nit: '1089012073', razonSocial: 'HYDRAULICS & PNEUMATICS S.A.', nombreContacto: 'Tec. Luis Gutierrez', telefono: '33557799', email: 'lgutierrez@hydpneu.bo', tipoEmpresa: 'REPARACION' },
        { id: '8', nit: '1090123084', razonSocial: 'AVIONICS SERVICE CENTER', nombreContacto: 'Ing. Ana Quispe', telefono: '77335599', email: 'aquispe@avionics.bo', tipoEmpresa: 'MANTENIMIENTO' }
    ];

    tercerosFiltrados: Tercero[] = [];

    tiposEmpresa = [
        { value: 'CALIBRACION', label: 'Calibración', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-300' },
        { value: 'REPARACION', label: 'Reparación', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-300' },
        { value: 'MANTENIMIENTO', label: 'Mantenimiento', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-300' },
        { value: 'PROVEEDOR', label: 'Proveedor', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-300' }
    ];

    condicionesDevolucion = [
        { value: 'BUENO', label: 'Bueno', color: 'bg-green-500 text-white' },
        { value: 'REPARADO', label: 'Reparado', color: 'bg-blue-500 text-white' },
        { value: 'CALIBRADO', label: 'Calibrado', color: 'bg-cyan-500 text-white' },
        { value: 'PARCIAL', label: 'Reparación Parcial', color: 'bg-yellow-500 text-black' },
        { value: 'NO_REPARABLE', label: 'No Reparable', color: 'bg-red-500 text-white' }
    ];

    dataSource: DevolucionTerceroItem[] = [];
    itemIdCounter = 1;

    ngOnInit(): void {
        this.initForm();
        this.tercerosFiltrados = [...this.terceros];
        this.loadTerceros();
    }

    private loadTerceros(): void {
        this.movementService.getTerceros().pipe(
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (data) => {
                if (data && data.length > 0) {
                    this.terceros = data.map((t: any) => ({
                        id:             t.id            || t.id_customer  || '',
                        nit:            t.nit           || t.tax_id       || '',
                        razonSocial:    t.razonSocial   || t.nombre       || t.name || '',
                        nombreContacto: t.nombreContacto || t.contact_name || '',
                        telefono:       t.telefono      || t.phone        || '',
                        email:          t.email         || '',
                        tipoEmpresa:    t.tipoEmpresa   || t.type         || 'PROVEEDOR'
                    }));
                    this.tercerosFiltrados = [...this.terceros];
                }
                // Si falla o viene vacío, conserva la lista hardcodeada como fallback
            },
            error: () => {} // fallback silencioso a la lista hardcodeada
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private initForm(): void {
        this.devolucionForm = this.fb.group({
            tercero: ['', Validators.required],
            codigoHerramienta: [''],
            fechaDevolucion: [new Date().toISOString().split('T')[0], Validators.required],
            observaciones: ['']
        });

        this.devolucionForm.get('tercero')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll),
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(value => {
            this.filtrarTerceros(value);
        });
    }

    private filtrarTerceros(valor: string): void {
        if (!valor || typeof valor !== 'string') {
            this.tercerosFiltrados = [...this.terceros];
            return;
        }
        const filtro = valor.toLowerCase();
        this.tercerosFiltrados = this.terceros.filter(t =>
            t.razonSocial.toLowerCase().includes(filtro) ||
            t.nit.toLowerCase().includes(filtro) ||
            t.nombreContacto.toLowerCase().includes(filtro) ||
            t.tipoEmpresa.toLowerCase().includes(filtro)
        );
    }

    displayTercero(tercero: Tercero): string {
        return tercero ? `${tercero.nit} - ${tercero.razonSocial}` : '';
    }

    getTipoEmpresaClass(tipo: string): string {
        const tipoObj = this.tiposEmpresa.find(t => t.value === tipo);
        return tipoObj ? tipoObj.color : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-300';
    }

    getTipoEmpresaLabel(tipo: string): string {
        const tipoObj = this.tiposEmpresa.find(t => t.value === tipo);
        return tipoObj ? tipoObj.label : tipo;
    }

    getCondicionClass(condicion: string): string {
        const cond = this.condicionesDevolucion.find(c => c.value === condicion);
        return cond ? cond.color : 'bg-gray-500 text-white';
    }

    getCondicionLabel(condicion: string): string {
        const cond = this.condicionesDevolucion.find(c => c.value === condicion);
        return cond ? cond.label : condicion;
    }

    getDiasFueraClass(dias: number): string {
        if (dias <= 7) return 'bg-green-100 text-green-800';
        if (dias <= 30) return 'bg-yellow-100 text-yellow-800';
        if (dias <= 60) return 'bg-orange-100 text-orange-800';
        return 'bg-red-100 text-red-800';
    }

    getDiasText(dias: number): string {
        if (dias === 1) return '1 día';
        if (dias < 7) return `${dias} días`;
        if (dias < 30) return `${Math.floor(dias/7)} semanas`;
        if (dias < 365) return `${Math.floor(dias/30)} meses`;
        return `${Math.floor(dias/365)} años`;
    }

    private calcularDiasFuera(fechaSalida: string): number {
        const salida = new Date(fechaSalida);
        const hoy = new Date();
        const diffTime = Math.abs(hoy.getTime() - salida.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    goBack(): void {
        if (this.dataSource.some(item => item.selected)) {
            if (!confirm('Hay items seleccionados. ¿Está seguro de salir?')) {
                return;
            }
        }
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/entradas']);
        }
    }

    buscarHerramientas(): void {
        const tercero = this.devolucionForm.get('tercero')?.value;

        if (!tercero || typeof tercero === 'string') {
            this.showMessage('Seleccione un tercero de la lista', 'warning');
            return;
        }

        this.isSearching = true;

        // Buscar préstamos externos activos para este tercero
        this.movementService.getMovements({
            type: 'PRESTAMO_EXTERNO',
            status: 'ACTIVO'
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSearching = false)
        ).subscribe({
            next: (data) => {
                const filtered = (data || []).filter((mov: any) =>
                    mov.customer === tercero.razonSocial ||
                    mov.recipient === tercero.razonSocial
                );

                if (filtered.length > 0) {
                    this.dataSource = filtered.flatMap((mov: any) => {
                        const items = mov.items || [];
                        return items.map((item: any) => ({
                            id: this.itemIdCounter++,
                            fila: 0,
                            toolId: item.toolId || item.tool?.id || item.tool_id || '',
                            codigo: item.tool?.code || item.codigo || '',
                            pn: item.tool?.partNumber || item.pn || '',
                            descripcion: item.tool?.description || item.descripcion || '',
                            marca: item.tool?.brand || item.marca || '',
                            fechaSalida: mov.date || '',
                            diasFuera: mov.date ? this.calcularDiasFuera(mov.date) : 0,
                            cantidad: item.quantity || 1,
                            nroNotaSalida: mov.movementNumber || mov.movement_number || '',
                            tipoContrato: tercero.tipoEmpresa,
                            proyecto: mov.work_order_number || '',
                            estado: 'EN_TERCERO',
                            condicionDevolucion: '',
                            observaciones: '',
                            selected: false
                        }));
                    });
                    this.dataSource.forEach((item, idx) => item.fila = idx + 1);
                    this.showMessage(`Se encontraron ${this.dataSource.length} herramienta(s) en ${tercero.razonSocial}`, 'success');
                } else {
                    this.loadMockData(tercero);
                }
            },
            error: () => {
                this.loadMockData(tercero);
            }
        });
    }

    private loadMockData(tercero: Tercero): void {
        const mockDataByType: { [key: string]: DevolucionTerceroItem[] } = {
            'CALIBRACION': [
                {
                    id: this.itemIdCounter++, fila: 1, codigo: 'BOA-H-0289', pn: 'TRQ-250-1000',
                    descripcion: 'TORQUIMETRO DIGITAL 250-1000 LB/FT', marca: 'TOHNICHI',
                    fechaSalida: '2025-01-05', diasFuera: this.calcularDiasFuera('2025-01-05'),
                    cantidad: 1, nroNotaSalida: 'SAL-2025-045', tipoContrato: 'CALIBRACION',
                    proyecto: 'CAL-2025-001', estado: 'EN_TERCERO', condicionDevolucion: '',
                    observaciones: 'Calibración anual programada', selected: false
                },
                {
                    id: this.itemIdCounter++, fila: 2, codigo: 'BOA-H-0523', pn: 'DG-CALIPER-6',
                    descripcion: 'CALIBRADOR DIGITAL 6 PULGADAS', marca: 'MITUTOYO',
                    fechaSalida: '2025-01-08', diasFuera: this.calcularDiasFuera('2025-01-08'),
                    cantidad: 2, nroNotaSalida: 'SAL-2025-052', tipoContrato: 'CALIBRACION',
                    proyecto: 'CAL-2025-001', estado: 'EN_TERCERO', condicionDevolucion: '',
                    observaciones: 'Incluye certificado IBMETRO', selected: false
                },
                {
                    id: this.itemIdCounter++, fila: 3, codigo: 'BOA-H-0856', pn: 'TRQ-50-250',
                    descripcion: 'TORQUIMETRO CLICK 50-250 LB/IN', marca: 'SNAP-ON',
                    fechaSalida: '2025-01-10', diasFuera: this.calcularDiasFuera('2025-01-10'),
                    cantidad: 1, nroNotaSalida: 'SAL-2025-058', tipoContrato: 'CALIBRACION',
                    proyecto: 'CAL-2025-002', estado: 'EN_TERCERO', condicionDevolucion: '',
                    observaciones: '', selected: false
                }
            ],
            'REPARACION': [
                {
                    id: this.itemIdCounter++, fila: 1, codigo: 'BOA-H-1189', pn: 'DRILL-90DEG',
                    descripcion: 'TALADRO ANGULAR 90 GRADOS', marca: 'INGERSOLL RAND',
                    fechaSalida: '2024-12-15', diasFuera: this.calcularDiasFuera('2024-12-15'),
                    cantidad: 1, nroNotaSalida: 'SAL-2024-298', tipoContrato: 'REPARACION',
                    proyecto: 'REP-2024-045', estado: 'EN_TERCERO', condicionDevolucion: '',
                    observaciones: 'Cambio de rodamientos y sellos', selected: false
                },
                {
                    id: this.itemIdCounter++, fila: 2, codigo: 'BOA-H-0745', pn: 'E32-101-550',
                    descripcion: 'EXTRACTOR BEARING NLG A330', marca: 'AIRBUS GSE',
                    fechaSalida: '2024-12-20', diasFuera: this.calcularDiasFuera('2024-12-20'),
                    cantidad: 1, nroNotaSalida: 'SAL-2024-305', tipoContrato: 'REPARACION',
                    proyecto: 'REP-2024-048', estado: 'EN_TERCERO', condicionDevolucion: '',
                    observaciones: 'Daño estructural - Requiere reemplazo', selected: false
                }
            ],
            'MANTENIMIENTO': [
                {
                    id: this.itemIdCounter++, fila: 1, codigo: 'BOA-H-1078', pn: 'RIVET-GUN-3X',
                    descripcion: 'PISTOLA REMACHADORA NEUMATICA 3X', marca: 'ATLAS COPCO',
                    fechaSalida: '2025-01-02', diasFuera: this.calcularDiasFuera('2025-01-02'),
                    cantidad: 1, nroNotaSalida: 'SAL-2025-012', tipoContrato: 'MANTENIMIENTO',
                    proyecto: 'MNT-2025-003', estado: 'EN_TERCERO', condicionDevolucion: '',
                    observaciones: 'Mantenimiento preventivo anual', selected: false
                },
                {
                    id: this.itemIdCounter++, fila: 2, codigo: 'BOA-H-0634', pn: 'HYD-PRESS-3000',
                    descripcion: 'GATO HIDRAULICO 3 TON', marca: 'MALABAR',
                    fechaSalida: '2025-01-03', diasFuera: this.calcularDiasFuera('2025-01-03'),
                    cantidad: 1, nroNotaSalida: 'SAL-2025-015', tipoContrato: 'MANTENIMIENTO',
                    proyecto: 'MNT-2025-003', estado: 'EN_TERCERO', condicionDevolucion: '',
                    observaciones: 'Cambio de aceite, sello pendiente', selected: false
                }
            ]
        };

        const tipoKey = tercero.tipoEmpresa;
        this.dataSource = mockDataByType[tipoKey] || mockDataByType['CALIBRACION'];

        this.dataSource.forEach((item, index) => {
            item.fila = index + 1;
        });

        this.showMessage(`Se encontraron ${this.dataSource.length} herramienta(s) en ${tercero.razonSocial}`, 'success');
    }

    toggleSelection(item: DevolucionTerceroItem): void {
        item.selected = !item.selected;
    }

    toggleAllSelection(event: any): void {
        const checked = event.checked;
        this.dataSource.forEach(item => item.selected = checked);
    }

    isAllSelected(): boolean {
        return this.dataSource.length > 0 && this.dataSource.every(item => item.selected);
    }

    isSomeSelected(): boolean {
        return this.dataSource.some(item => item.selected) && !this.isAllSelected();
    }

    getSelectedCount(): number {
        return this.dataSource.filter(item => item.selected).length;
    }

    getSelectedItems(): DevolucionTerceroItem[] {
        return this.dataSource.filter(item => item.selected);
    }

    getResumenPorCondicion(): any {
        const selectedItems = this.getSelectedItems();
        return {
            buenos: selectedItems.filter(item => item.condicionDevolucion === 'BUENO').length,
            reparado: selectedItems.filter(item => item.condicionDevolucion === 'REPARADO').length,
            calibrado: selectedItems.filter(item => item.condicionDevolucion === 'CALIBRADO').length,
            parcial: selectedItems.filter(item => item.condicionDevolucion === 'PARCIAL').length,
            'no_reparable': selectedItems.filter(item => item.condicionDevolucion === 'NO_REPARABLE').length,
            pendientes: selectedItems.filter(item => !item.condicionDevolucion).length
        };
    }

    getTotalCantidad(): number {
        return this.getSelectedItems().reduce((sum, item) => sum + item.cantidad, 0);
    }

    getItemsCriticos(): DevolucionTerceroItem[] {
        return this.getSelectedItems().filter(item =>
            (item.diasFuera > 60) || item.condicionDevolucion === 'NO_REPARABLE'
        );
    }

    updateCondicion(item: DevolucionTerceroItem, condicion: string): void {
        item.condicionDevolucion = condicion;
    }

    openConfirmModal(): void {
        const selectedItems = this.getSelectedItems();
        if (selectedItems.length === 0) {
            this.showMessage('Seleccione al menos una herramienta', 'warning');
            return;
        }

        const sinCondicion = selectedItems.filter(item => !item.condicionDevolucion);
        if (sinCondicion.length > 0) {
            this.showMessage('Asigne condición de devolución a todos los items seleccionados', 'warning');
            return;
        }

        this.showConfirmModal = true;
    }

    closeConfirmModal(): void {
        this.showConfirmModal = false;
    }

    finalizar(): void {
        const selectedItems = this.getSelectedItems();

        if (selectedItems.length === 0) {
            this.showMessage('Seleccione al menos una herramienta', 'warning');
            return;
        }

        const tercero = this.devolucionForm.get('tercero')?.value;
        if (!tercero || typeof tercero === 'string') {
            this.showMessage('Debe seleccionar un tercero', 'error');
            return;
        }

        const sinCondicion = selectedItems.filter(item => !item.condicionDevolucion);
        if (sinCondicion.length > 0) {
            this.showMessage('Asigne condición de devolución a todos los items seleccionados', 'warning');
            return;
        }

        // Validar que los items tienen ID real (no mock)
        const sinId = selectedItems.filter(i => !i.toolId || isNaN(Number(i.toolId)));
        if (sinId.length > 0) {
            this.showMessage(`${sinId.length} herramienta(s) sin ID de sistema — consulte datos reales desde el API`, 'error');
            this.closeConfirmModal();
            return;
        }

        this.closeConfirmModal();
        this.isSaving = true;

        const itemsJson = JSON.stringify(selectedItems.map(item => ({
            tool_id: Number(item.toolId),
            quantity: item.cantidad,
            condicion: item.condicionDevolucion,
            notes: item.observaciones || ''
        })));

        this.movementService.registrarDevolucionPrestamo({
            type: 'DEVOLUCION_PRESTAMO_EXTERNO',
            date: this.devolucionForm.value.fechaDevolucion,
            time: new Date().toTimeString().slice(0, 8),
            requested_by_name: tercero.razonSocial,
            responsible_person: '',
            recipient: tercero.razonSocial,
            customer: tercero.razonSocial,
            notes: this.devolucionForm.value.observaciones || '',
            items_json: itemsJson
        }).pipe(
            finalize(() => this.isSaving = false),
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.abrirImpresionDevolucionTercero(nro, selectedItems, tercero, this.devolucionForm.value);
                this.showMessage(`Devolución de ${selectedItems.length} herramienta(s) registrada: ${nro}`, 'success');
                this.dataSource = this.dataSource.filter(item => !item.selected);
                this.dataSource.forEach((item, index) => item.fila = index + 1);
                if (this.dialogRef) this.dialogRef.close({ success: true });
            },
            error: (err) => {
                console.error('Error:', err);
                this.showMessage(`Error al registrar la devolución: ${err?.message || ''}`, 'error');
            }
        });
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        const config: any = {
            duration: 4000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: [`snackbar-${type}`]
        };
        this.snackBar.open(message, 'Cerrar', config);
    }

    hasError(field: string, error: string): boolean {
        const control = this.devolucionForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    // ── PDF / Impresión MGH-100 Devolución Terceros ───────────────────────────

    private abrirImpresionDevolucionTercero(nro: string, items: DevolucionTerceroItem[], tercero: any, fv: any): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const now  = new Date().toLocaleString('es-BO');
        const rows = items.map(item => `
            <tr>
                <td>${item.codigo || '-'}</td>
                <td>${item.pn || '-'}</td>
                <td>${item.marca || '-'}</td>
                <td style="text-align:center;font-weight:700">${item.cantidad}</td>
                <td>${item.descripcion || '-'}</td>
                <td>${item.nroNotaSalida || '-'}</td>
                <td>${item.fechaSalida || '-'}</td>
                <td style="text-align:center">${item.diasFuera}</td>
                <td><span style="padding:2px 6px;border:1px solid #000;font-size:8.5px;font-weight:700">${item.condicionDevolucion}</span></td>
                <td>${item.observaciones || ''}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Devolución Terceros ${nro}</title>
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
  .lbl { background: #f0f0f0; font-weight: 700; font-size: 9px; width: 120px; }
  .nro-cell { background: #f0f0f0; text-align: center; font-weight: 900; font-size: 15px; vertical-align: middle; width: 120px; }
  .sec { background: #111A43; color: white; padding: 3px 8px; font-weight: 900; font-size: 10px;
         text-transform: uppercase; border: 1px solid #000; }
  table.det { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.det th { background: #111A43; color: white; padding: 5px 4px; font-size: 8.5px; font-weight: 900;
                 text-transform: uppercase; border: 1px solid #000; text-align: center; }
  table.det td { padding: 4px; border: 1px solid #ddd; font-size: 9px; }
  table.det tr:nth-child(even) td { background: #f9f9f9; }
  .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
  .sig { border: 1px solid #000; padding: 6px 8px; text-align: center; }
  .sig-ttl { font-weight: 900; font-size: 9px; text-transform: uppercase; margin-bottom: 26px; }
  .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 8.5px; }
  .footer { text-align: center; margin-top: 10px; font-size: 7.5px; color: #888; border-top: 1px dotted #ccc; padding-top: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <div class="top">
    <div style="font-weight:900;font-size:11px">BoAMM &nbsp; OAM145# N-114</div>
    <div style="text-align:right">
      <div class="code-box">MGH-100</div><br><span style="font-size:9px">REV. 0 &nbsp; 2016-10-13</span>
    </div>
  </div>
  <h1>NOTA DE PRÉSTAMO - DEVOLUCIÓN A TERCEROS</h1>
  <table class="info-tbl">
    <tr>
      <td class="lbl">NOMBRE SOLICITANTE:</td>
      <td>${tercero?.razonSocial || ''}</td>
      <td class="lbl">EMPRESA / ENTIDAD:</td>
      <td>${tercero?.razonSocial || ''}</td>
      <td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro || '___________'}</td>
    </tr>
    <tr>
      <td class="lbl">CONTACTO:</td><td>${tercero?.nombreContacto || ''}</td>
      <td class="lbl">NIT:</td><td>${tercero?.nit || ''}</td>
    </tr>
    <tr>
      <td class="lbl">FECHA DEVOLUCIÓN:</td><td>${fv.fechaDevolucion || ''}</td>
      <td class="lbl">OBSERVACIONES:</td><td>${fv.observaciones || ''}</td>
    </tr>
  </table>
  <div class="sec">DATOS DEVOLUCIÓN</div>
  <table class="det">
    <thead><tr>
      <th>CÓDIGO</th><th>P/N</th><th>MARCA</th><th>CANT.</th><th>DESCRIPCIÓN</th>
      <th>NRO NOTA SALIDA</th><th>FECHA SALIDA</th><th>DÍAS FUERA</th><th>CONDICIÓN</th><th>OBS</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sigs">
    <div class="sig">
      <div class="sig-ttl">DEVUELTO POR</div>
      <div style="font-size:9px;margin-bottom:16px">${tercero?.razonSocial || '____________________'}</div>
      <div class="sig-line">Firma Representante Tercero</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">RECIBIDO POR</div>
      <div class="sig-line">Firma Almacén Herramientas BOA</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">AUTORIZADO POR</div>
      <div class="sig-line">Firma Autorizada BOA</div>
    </div>
  </div>
  <div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
</body></html>`;

        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 600);
    }
}
