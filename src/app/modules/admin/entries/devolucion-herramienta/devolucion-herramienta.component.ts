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
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';

interface Funcionario {
    id: string;
    licencia: string;
    nombreCompleto: string;
    cargo?: string;
    departamento?: string;
    area?: string;
}

interface DevolucionItem {
    fila: number;
    toolId?: string;
    codigo: string;
    descripcion: string;
    pn: string;
    sn: string;
    marca?: string;
    fechaPrestamo: string;
    cantidadPrestada: number;
    cantidadDevolver: number;
    nroNotaSalida: string;
    aeronave: string;
    ordenTrabajo?: string;
    tipoPrestamo: 'OT' | 'EVENTUAL' | 'PERSONAL' | 'AOG';
    diasFuera: number;
    condicionDevolucion: 'BUENO' | 'DAÑADO' | 'IRREPARABLE' | 'REQUIERE_CALIBRACION';
    observacionItem: string;
    selected: boolean;
}

type CondicionDevolucion = 'BUENO' | 'DAÑADO' | 'IRREPARABLE' | 'REQUIERE_CALIBRACION';

@Component({
    selector: 'app-devolucion-herramienta',
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
        MatAutocompleteModule,
        MatTooltipModule,
        MatCheckboxModule,
        DragDropModule
    ],
    templateUrl: './devolucion-herramienta.component.html',
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

        .row-selected {
            background-color: #fef3c7 !important;
        }

        :host-context(.dark) .row-selected {
            background-color: rgba(251, 191, 36, 0.2) !important;
        }
    `]
})
export class DevolucionHerramientaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<DevolucionHerramientaComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private movementService = inject(MovementService);

    private _unsubscribeAll = new Subject<void>();

    // Formulario reactivo
    devolucionForm!: FormGroup;

    // Estados
    isLoading = false;
    isSaving = false;
    isSearching = false;
    showConfirmation = false;

    // Listas
    funcionarios: Funcionario[] = [];
    funcionariosFiltrados: Funcionario[] = [];
    tiposDevolucion = [
        { value: 'PRESTAMO', label: 'PRÉSTAMO' },
        { value: 'ASIGNACION', label: 'ASIGNACIÓN' },
        { value: 'TEMPORAL', label: 'TEMPORAL' }
    ];

    tiposPrestamo = [
        { value: 'OT', label: 'Orden de Trabajo', color: 'bg-blue-100 text-blue-800' },
        { value: 'EVENTUAL', label: 'Eventual', color: 'bg-green-100 text-green-800' },
        { value: 'PERSONAL', label: 'Personal', color: 'bg-purple-100 text-purple-800' },
        { value: 'AOG', label: 'AOG', color: 'bg-red-100 text-red-800' }
    ];

    condiciones: { value: CondicionDevolucion; label: string; color: string; icon: string }[] = [
        { value: 'BUENO', label: 'BUENO', color: 'bg-green-100 text-green-800 border-green-500', icon: 'check_circle' },
        { value: 'DAÑADO', label: 'DAÑADO', color: 'bg-red-100 text-red-800 border-red-500', icon: 'warning' },
        { value: 'IRREPARABLE', label: 'IRREPARABLE', color: 'bg-gray-100 text-gray-800 border-gray-500', icon: 'cancel' },
        { value: 'REQUIERE_CALIBRACION', label: 'REQ. CALIBRACIÓN', color: 'bg-amber-100 text-amber-800 border-amber-500', icon: 'build' }
    ];

    displayedColumns: string[] = [
        'select', 'fila', 'codigo', 'descripcion', 'pn', 'sn',
        'tipoPrestamo', 'aeronave', 'fechaPrestamo', 'diasFuera',
        'cantidadPrestada', 'cantidadDevolver', 'condicion', 'observacionItem'
    ];

    dataSource: DevolucionItem[] = [];

    constructor() {}

    ngOnInit(): void {
        this.initForm();
        this.loadInitialData();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private initForm(): void {
        this.devolucionForm = this.fb.group({
            funcionario: ['', Validators.required],
            tipoDe: ['PRESTAMO'],
            codigoHerramienta: [''],
            fechaDevolucion: [new Date().toISOString().split('T')[0], Validators.required],
            responsableRecibe: ['', Validators.required],
            observaciones: ['']
        });

        // Filtrar funcionarios mientras escribe
        this.devolucionForm.get('funcionario')?.valueChanges.pipe(
            takeUntil(this._unsubscribeAll),
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(value => {
            this.filtrarFuncionarios(value);
        });
    }

    private loadInitialData(): void {
        this.isLoading = true;

        this.movementService.getPersonal().pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (data) => {
                this.funcionarios = data.map((p: any) => ({
                    id: p.id || p.id_personal,
                    licencia: p.licencia || p.nro_licencia || '',
                    nombreCompleto: `${p.nombre || ''} ${p.apellido_paterno || ''} ${p.apellido_materno || ''}`.trim(),
                    cargo: p.cargo || '',
                    departamento: p.departamento || '',
                    area: p.area || ''
                }));
                this.funcionariosFiltrados = [...this.funcionarios];
            },
            error: () => {
                this.funcionarios = [];
                this.funcionariosFiltrados = [];
            }
        });
    }

    private filtrarFuncionarios(valor: string): void {
        if (!valor || typeof valor !== 'string') {
            this.funcionariosFiltrados = [...this.funcionarios];
            return;
        }
        const filtro = valor.toLowerCase();
        this.funcionariosFiltrados = this.funcionarios.filter(f =>
            f.nombreCompleto.toLowerCase().includes(filtro) ||
            f.licencia.toLowerCase().includes(filtro)
        );
    }

    displayFuncionario(funcionario: Funcionario): string {
        return funcionario ? `${funcionario.licencia} - ${funcionario.nombreCompleto}` : '';
    }

    goBack(): void {
        if (this.dataSource.some(item => item.selected)) {
            if (!confirm('¿Está seguro de salir? Hay items seleccionados que no se han procesado.')) {
                return;
            }
        }

        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/entradas']);
        }
    }

    realizarConsulta(): void {
        const funcionario = this.devolucionForm.get('funcionario')?.value;

        if (!funcionario || typeof funcionario === 'string') {
            this.showMessage('Seleccione un funcionario de la lista', 'warning');
            return;
        }

        this.isSearching = true;
        this.dataSource = [];

        forkJoin({
            loans: this.movementService.getActiveLoans(),
            items: this.movementService.getActiveLoanItems()
        }).pipe(
            takeUntil(this._unsubscribeAll),
            finalize(() => this.isSearching = false)
        ).subscribe({
            next: ({ loans, items }) => {
                const nombreBuscado = funcionario.nombreCompleto?.toLowerCase() || '';
                const licencia = funcionario.licencia?.toLowerCase() || '';

                const filtered = (loans || []).filter((loan: any) =>
                    loan.borrower_name?.toLowerCase() === nombreBuscado ||
                    loan.borrower_name?.toLowerCase().includes(nombreBuscado) ||
                    loan.borrower_license?.toLowerCase() === licencia
                );

                if (filtered.length > 0) {
                    this.dataSource = filtered.flatMap((loan: any) => {
                        const loanItems = (items || []).filter((i: any) =>
                            String(i.loan_id) === String(loan.id_loan)
                        );
                        const fechaPrestamo = loan.loan_date || '';
                        return loanItems.map((item: any) => ({
                            fila: 0,
                            toolId: String(item.tool_id || ''),
                            codigo: item.code || '',
                            descripcion: item.description || item.name || '',
                            pn: item.part_number || '',
                            sn: item.serial_number || '',
                            marca: item.brand || '',
                            fechaPrestamo,
                            cantidadPrestada: Number(item.quantity) || 1,
                            cantidadDevolver: Number(item.quantity) || 1,
                            nroNotaSalida: loan.loan_number || '',
                            aeronave: loan.aircraft || '',
                            ordenTrabajo: loan.work_order_number || '',
                            tipoPrestamo: 'EVENTUAL' as any,
                            diasFuera: fechaPrestamo ? this.calcularDiasFuera(fechaPrestamo) : 0,
                            condicionDevolucion: 'BUENO' as CondicionDevolucion,
                            observacionItem: '',
                            selected: false
                        }));
                    });
                    this.dataSource.forEach((item, idx) => item.fila = idx + 1);
                    this.showMessage(`Se encontraron ${this.dataSource.length} herramienta(s) prestadas`, 'success');
                } else {
                    this.dataSource = [];
                    this.showMessage(`No se encontraron préstamos activos para ${funcionario.nombreCompleto}`, 'info');
                }
            },
            error: (err) => {
                this.dataSource = [];
                this.showMessage('Error al consultar préstamos: ' + (err?.message || ''), 'error');
            }
        });
    }

    private calcularDiasFuera(fechaPrestamo: string): number {
        const prestamo = new Date(fechaPrestamo);
        const hoy = new Date();
        const diffTime = Math.abs(hoy.getTime() - prestamo.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    getTipoPrestamoClass(tipo: string): string {
        const tipoPrestamo = this.tiposPrestamo.find(t => t.value === tipo);
        return tipoPrestamo ? tipoPrestamo.color : 'bg-gray-100 text-gray-800';
    }

    getDiasFueraClass(dias: number): string {
        if (dias <= 3) return 'bg-green-100 text-green-800';
        if (dias <= 7) return 'bg-yellow-100 text-yellow-800';
        if (dias <= 15) return 'bg-orange-100 text-orange-800';
        return 'bg-red-100 text-red-800';
    }

    toggleSelection(item: DevolucionItem): void {
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

    getSelectedItems(): DevolucionItem[] {
        return this.dataSource.filter(item => item.selected);
    }

    onCondicionChange(item: DevolucionItem): void {
        // Si la condición es BUENO, limpiar observación
        if (item.condicionDevolucion === 'BUENO') {
            item.observacionItem = '';
        }
    }

    getCondicionClass(condicion: CondicionDevolucion): string {
        const cond = this.condiciones.find(c => c.value === condicion);
        return cond ? cond.color : '';
    }

    getCondicionIcon(condicion: CondicionDevolucion): string {
        const cond = this.condiciones.find(c => c.value === condicion);
        return cond ? cond.icon : 'help';
    }

    validateItems(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const selectedItems = this.getSelectedItems();

        if (selectedItems.length === 0) {
            errors.push('Seleccione al menos una herramienta para devolver');
            return { valid: false, errors };
        }

        const fechaDevolucion = new Date(this.devolucionForm.value.fechaDevolucion);

        selectedItems.forEach((item, idx) => {
            // Validar cantidad
            if (item.cantidadDevolver <= 0) {
                errors.push(`Item ${item.fila}: La cantidad a devolver debe ser mayor a 0`);
            }
            if (item.cantidadDevolver > item.cantidadPrestada) {
                errors.push(`Item ${item.fila}: La cantidad a devolver no puede ser mayor a la prestada (${item.cantidadPrestada})`);
            }

            // Validar observación si condición no es BUENO
            if (item.condicionDevolucion !== 'BUENO' && !item.observacionItem.trim()) {
                errors.push(`Item ${item.fila} (${item.codigo}): La observación es obligatoria cuando la condición es ${item.condicionDevolucion}`);
            }

            // Validar fecha de devolución >= fecha de préstamo
            const fechaPrestamo = new Date(item.fechaPrestamo);
            if (fechaDevolucion < fechaPrestamo) {
                errors.push(`Item ${item.fila}: La fecha de devolución no puede ser anterior a la fecha de préstamo`);
            }
        });

        return { valid: errors.length === 0, errors };
    }

    procesar(): void {
        const validation = this.validateItems();

        if (!validation.valid) {
            validation.errors.forEach(err => this.showMessage(err, 'error'));
            return;
        }

        // Mostrar modal de confirmación
        this.showConfirmation = true;
    }

    cancelarConfirmacion(): void {
        this.showConfirmation = false;
    }

    getResumenPorCondicion(): { condicion: string; cantidad: number; color: string }[] {
        const selectedItems = this.getSelectedItems();
        const resumen: { [key: string]: number } = {};

        selectedItems.forEach(item => {
            resumen[item.condicionDevolucion] = (resumen[item.condicionDevolucion] || 0) + 1;
        });

        return Object.entries(resumen).map(([condicion, cantidad]) => ({
            condicion: this.condiciones.find(c => c.value === condicion)?.label || condicion,
            cantidad,
            color: this.condiciones.find(c => c.value === condicion)?.color || ''
        }));
    }

    finalizar(): void {
        const validation = this.validateItems();

        if (!validation.valid) {
            validation.errors.forEach(err => this.showMessage(err, 'error'));
            return;
        }

        const funcionario = this.devolucionForm.get('funcionario')?.value;
        if (!funcionario || typeof funcionario === 'string') {
            this.showMessage('Debe seleccionar un funcionario', 'error');
            return;
        }

        if (!this.devolucionForm.value.responsableRecibe?.trim()) {
            this.showMessage('Debe ingresar el responsable que recibe', 'error');
            return;
        }

        const selectedItems = this.getSelectedItems();

        // Validar que los items tienen ID real (no mock)
        const sinId = selectedItems.filter(i => !i.toolId || isNaN(Number(i.toolId)));
        if (sinId.length > 0) {
            this.showMessage(`${sinId.length} herramienta(s) sin ID de sistema — consulte datos reales desde el API`, 'error');
            return;
        }

        this.showConfirmation = false;
        this.isSaving = true;

        const itemsJson = JSON.stringify(selectedItems.map(item => ({
            tool_id: Number(item.toolId),
            quantity: item.cantidadDevolver,
            condicion: item.condicionDevolucion,
            notes: item.observacionItem || ''
        })));

        this.movementService.registrarDevolucionPrestamo({
            type: 'DEVOLUCION_PRESTAMO_INTERNO',
            date: this.devolucionForm.value.fechaDevolucion,
            time: new Date().toTimeString().slice(0, 8),
            requested_by_name: funcionario.nombreCompleto,
            responsible_person: this.devolucionForm.value.responsableRecibe,
            recipient: funcionario.nombreCompleto,
            notes: this.devolucionForm.value.observaciones || '',
            items_json: itemsJson
        }).pipe(
            finalize(() => this.isSaving = false),
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number || '---';
                this.abrirImpresionDevolucion(nro, selectedItems,
                    funcionario, this.devolucionForm.value);
                this.showMessage(`Devolución registrada: ${nro}`, 'success');

                // Remover items devueltos completamente; mantener devoluciones parciales
                this.dataSource = this.dataSource.filter(item => {
                    if (!item.selected) return true;
                    return item.cantidadDevolver < item.cantidadPrestada;
                });
                this.dataSource.forEach(item => {
                    if (item.selected && item.cantidadDevolver < item.cantidadPrestada) {
                        item.cantidadPrestada -= item.cantidadDevolver;
                        item.cantidadDevolver = item.cantidadPrestada;
                        item.selected = false;
                    }
                });
                this.dataSource.forEach((item, index) => item.fila = index + 1);

                if (this.dialogRef) this.dialogRef.close({ success: true, data: result });
            },
            error: (err) => {
                console.error('Error al guardar:', err);
                this.showMessage('Error al registrar la devolución: ' + (err?.message || ''), 'error');
            }
        });
    }

    async openConsultaMovimientos(): Promise<void> {
        const { ConsultaMovimientosComponent } = await import('../consulta-movimientos/consulta-movimientos.component');
        this.dialog.open(ConsultaMovimientosComponent, {
            width: '1400px',
            maxWidth: '95vw',
            height: 'auto',
            maxHeight: '95vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false
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

    // ── PDF / Impresión MGH-100 Devolución ────────────────────────────────────

    private abrirImpresionDevolucion(nro: string, items: DevolucionItem[], funcionario: any, fv: any): void {
        const w = window.open('', '_blank');
        if (!w) return;
        const now  = new Date().toLocaleString('es-BO');
        const rows = items.map(item => `
            <tr>
                <td>${item.codigo || '-'}</td>
                <td>${item.pn || '-'}</td>
                <td>${item.sn || '-'}</td>
                <td style="text-align:center;font-weight:700">${item.cantidadDevolver}</td>
                <td>${item.descripcion || '-'}</td>
                <td>${item.nroNotaSalida || '-'}</td>
                <td>${item.fechaPrestamo || '-'}</td>
                <td><span style="padding:2px 6px;background:${this.condiciones.find(c=>c.value===item.condicionDevolucion)?.color||'#eee'};border:1px solid #000;font-size:8.5px;font-weight:700">${item.condicionDevolucion}</span></td>
                <td>${item.observacionItem || ''}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Devolución de Herramienta ${nro}</title>
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
  <h1>NOTA DE PRÉSTAMO - DEVOLUCIÓN<br>
    <span style="font-size:10px;font-weight:400">HERRAMIENTAS, BANCOS DE PRUEBA Y EQUIPOS DE APOYO</span>
  </h1>
  <table class="info-tbl">
    <tr>
      <td class="lbl">NOMBRE SOLICITANTE:</td>
      <td>${funcionario?.nombreCompleto || ''}</td>
      <td class="lbl">LICENCIA:</td>
      <td>${funcionario?.licencia || ''}</td>
      <td class="nro-cell" rowspan="3"><div style="font-size:8px;font-weight:400">N° NOTA</div>${nro || '___________'}</td>
    </tr>
    <tr>
      <td class="lbl">FECHA DEVOLUCIÓN:</td><td>${fv.fechaDevolucion || ''}</td>
      <td class="lbl">RESPONSABLE RECIBE:</td><td>${fv.responsableRecibe || ''}</td>
    </tr>
    <tr>
      <td class="lbl">OBSERVACIONES:</td><td colspan="3">${fv.observaciones || ''}</td>
    </tr>
  </table>
  <div class="sec">DATOS DEVOLUCIÓN</div>
  <table class="det">
    <thead><tr>
      <th>CÓDIGO</th><th>P/N</th><th>S/N</th><th>CANT.</th><th>DESCRIPCIÓN</th>
      <th>NRO NOTA PRÉSTAMO</th><th>FECHA PRÉSTAMO</th><th>CONDICIÓN</th><th>OBS</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sigs">
    <div class="sig">
      <div class="sig-ttl">DEVUELTO POR</div>
      <div style="font-size:9px;margin-bottom:16px">${funcionario?.nombreCompleto || '____________________'}</div>
      <div class="sig-line">Firma Técnico o Inspector</div>
    </div>
    <div class="sig">
      <div class="sig-ttl">RECIBIDO POR</div>
      <div style="font-size:9px;margin-bottom:16px">${fv.responsableRecibe || '____________________'}</div>
      <div class="sig-line">Firma Almacén Herramientas</div>
    </div>
    <div class="sig"><div class="sig-ttl">VERIFICADO POR</div><div class="sig-line">&nbsp;</div></div>
  </div>
  <div class="footer">Sistema de Gestión de Herramientas - BOA &nbsp;|&nbsp; ${now}</div>
</body></html>`;

        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 600);
    }
}
