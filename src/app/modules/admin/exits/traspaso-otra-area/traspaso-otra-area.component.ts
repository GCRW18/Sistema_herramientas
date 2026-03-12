import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil, finalize, timeout } from 'rxjs';
import { MovementService } from '../../../../core/services/movement.service';

interface TransferItem {
    toolId: number;
    codigo: string;
    partNumber: string;
    serialNumber: string;
    unidad: string;
    cantidad: number;
    descripcion: string;
    contenido: string;
    marca: string;
    fecha: string;
    estadoFisico: string;
    selected?: boolean;
}

@Component({
    selector: 'app-traspaso-otra-area',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatCheckboxModule,
        MatTooltipModule,
        MatDialogModule,
        MatSnackBarModule,
        DragDropModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './traspaso-otra-area.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }

        :host-context(.dark) { color-scheme: dark; }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base { background-color: #1e293b !important; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }

        .row-selected {
            background-color: #fffbeb !important;
            border-left: 4px solid #fbbf24 !important;
        }

        :host-context(.dark) .row-selected {
            background-color: rgba(251, 191, 36, 0.1) !important;
            border-left: 4px solid #fbbf24 !important;
        }

        .spinner-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 100;
        }

        :host-context(.dark) .spinner-overlay { background: rgba(0,0,0,0.7); }

        ::ng-deep .white-checkbox .mdc-checkbox__background { border-color: white !important; }
        ::ng-deep .white-checkbox.mat-mdc-checkbox-checked .mdc-checkbox__background {
            background-color: white !important;
            border-color: white !important;
        }
        ::ng-deep .white-checkbox .mdc-checkbox__checkmark { color: #0f172a !important; }
    `]
})
export class TraspasoOtraAreaComponent implements OnInit, OnDestroy {
    public dialogRef = inject(MatDialogRef<TraspasoOtraAreaComponent>, { optional: true });
    private dialog    = inject(MatDialog);
    private fb        = inject(FormBuilder);
    private router    = inject(Router);
    private snackBar  = inject(MatSnackBar);
    private movementService = inject(MovementService);
    private destroy$  = new Subject<void>();

    transferForm!: FormGroup;
    isSaving      = false;
    showConfirmModal = false;

    // Personal cargado desde la API (para búsqueda dinámica)
    private personalCache: any[] = [];
    filteredPersonal: any[] = [];
    showSuggestions = false;

    displayedColumns: string[] = [
        'select', 'fila', 'codigo', 'descripcion', 'partNumber', 'serialNumber',
        'unidadItem', 'cantidad', 'contenido', 'acciones'
    ];

    systemMsg = '';
    systemMsgType: 'success' | 'error' | 'info' | 'warning' = 'info';
    showSystemMsg = false;

    dataSource = signal<TransferItem[]>([]);

    ngOnInit(): void {
        this.initForm();
        this.cargarPersonal();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const now   = new Date();
        const hh    = now.getHours().toString().padStart(2, '0');
        const mm    = now.getMinutes().toString().padStart(2, '0');

        this.transferForm = this.fb.group({
            buscar:          [''],
            nombreCompleto:  ['', Validators.required],
            nroLicencia:     ['', Validators.required],
            cargo:           ['', Validators.required],
            fecha:           [today, Validators.required],
            hora:            [`${hh}:${mm}`, Validators.required],
            gerencia:        ['', Validators.required],
            unidad:          ['', Validators.required],
            base:            ['VVI', Validators.required],
            departamento:    [''],
            tipoTraspaso:    ['TEMPORAL', Validators.required],
            observaciones:   ['']
        });
    }

    private cargarPersonal(): void {
        this.movementService.getPersonal().pipe(takeUntil(this.destroy$)).subscribe({
            next: (personal) => { this.personalCache = personal; }
        });
    }

    // ── Búsqueda dinámica de personal ────────────────────────────────────────

    onBuscarInput(event: Event): void {
        const query = (event.target as HTMLInputElement).value.trim().toLowerCase();
        if (query.length < 3) {
            this.filteredPersonal = [];
            this.showSuggestions  = false;
            return;
        }
        this.filteredPersonal = this.personalCache.filter(p =>
            (p.nombreCompleto ?? '').toLowerCase().includes(query) ||
            (p.licencia ?? '').toLowerCase().includes(query)
        ).slice(0, 8);
        this.showSuggestions = this.filteredPersonal.length > 0;
    }

    seleccionarPersona(p: any): void {
        this.transferForm.patchValue({
            buscar:         p.nombreCompleto,
            nombreCompleto: p.nombreCompleto,
            nroLicencia:    p.licencia ?? p.nro_licencia ?? '',
            cargo:          p.cargo ?? ''
        });
        this.filteredPersonal = [];
        this.showSuggestions  = false;
    }

    hideSuggestions(): void {
        // Delay para permitir que el click en el item se registre primero
        setTimeout(() => { this.showSuggestions = false; }, 200);
    }

    /** Mantener botón BUSCAR para búsqueda exacta por si necesitan */
    buscarPersona(): void {
        const query = (this.transferForm.get('buscar')?.value ?? '').trim().toLowerCase();
        if (!query) return;
        const found = this.personalCache.find(p =>
            (p.nombreCompleto ?? '').toLowerCase().includes(query) ||
            (p.licencia ?? '').toLowerCase().includes(query)
        );
        if (found) { this.seleccionarPersona(found); }
        else { this.showMessage('No se encontró la persona', 'error'); }
    }

    // ── Selección de items ────────────────────────────────────────────────────

    toggleSelection(item: TransferItem): void {
        item.selected = !item.selected;
        this.dataSource.set([...this.dataSource()]);
    }

    toggleAllSelection(event: any): void {
        const items = this.dataSource();
        items.forEach(item => item.selected = event.checked);
        this.dataSource.set([...items]);
    }

    isAllSelected(): boolean {
        const items = this.dataSource();
        return items.length > 0 && items.every(item => item.selected);
    }

    isSomeSelected(): boolean {
        const items = this.dataSource();
        return items.some(item => item.selected) && !this.isAllSelected();
    }

    getSelectedCount(): number {
        return this.dataSource().filter(item => item.selected).length;
    }

    getTotalSelectedCantidad(): number {
        return this.dataSource().filter(item => item.selected).reduce((t, i) => t + (i.cantidad || 0), 0);
    }

    imprimir(): void {
        if (this.dataSource().length === 0) {
            this.showMessage('Agregue herramientas antes de imprimir', 'warning');
            return;
        }
        if (!this.transferForm.valid) {
            this.transferForm.markAllAsTouched();
            this.showMessage('Complete los datos requeridos', 'error');
            return;
        }
        window.print();
    }

    openConfirmModal(): void {
        if (this.dataSource().length === 0) {
            this.showMessage('Agregue al menos una herramienta', 'warning');
            return;
        }
        if (!this.transferForm.valid) {
            this.transferForm.markAllAsTouched();
            const errors = this.getFormErrors();
            this.showMessage(`Complete los campos requeridos: ${errors.join(', ')}`, 'error');
            return;
        }
        this.showConfirmModal = true;
    }

    closeConfirmModal(): void {
        this.showConfirmModal = false;
    }

    // ── Envío al backend ──────────────────────────────────────────────────────

    finalizar(): void {
        this.showConfirmModal = false;
        this.isSaving = true;

        const fv    = this.transferForm.getRawValue();
        const items = this.dataSource();

        const itemsJson = JSON.stringify(items.map(i => ({
            tool_id:               i.toolId,
            quantity:              i.cantidad,
            condition_on_movement: i.estadoFisico || 'SERVICEABLE',
            serial_number:         i.serialNumber || '',
            part_number:           i.partNumber   || '',
            notes:                 i.contenido    || ''
        })));

        const responsibleName = fv.nombreCompleto ?? '';
        const department      = `${fv.gerencia} | ${fv.unidad}`.trim();

        const payload: any = {
            date:                 fv.fecha,
            time:                 fv.hora,
            responsible_person:   responsibleName,
            department:           department,
            exit_reason:          fv.tipoTraspaso,
            authorized_by:        fv.nroLicencia,
            notes:                fv.observaciones ?? '',
            general_observations: `Base: ${fv.base} | Cargo: ${fv.cargo} | Licencia: ${fv.nroLicencia}`,
            items_json:           itemsJson
        };

        console.log('[TRASPASO] Payload:', payload);

        this.movementService.registrarTraspasoOtraArea(payload).pipe(
            timeout(30000),
            finalize(() => { this.isSaving = false; }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (result: any) => {
                const nro = result?.movement_number ?? '';
                this.showMessage(`Traspaso ${nro} registrado exitosamente`, 'success');
                this.dataSource.set([]);
                this.transferForm.reset();
                this.initForm();

                if (this.dialogRef) {
                    this.dialogRef.close({ success: true, movement_number: nro });
                } else {
                    setTimeout(() => this.router.navigate(['/salidas']), 2000);
                }
            },
            error: (err: any) => {
                console.error('[TRASPASO] Error:', err);
                const msg = err?.name === 'TimeoutError'
                    ? 'El servidor tardó demasiado. Intente de nuevo.'
                    : err?.message || 'Error al registrar el traspaso';
                this.showMessage(msg, 'error');
            }
        });
    }

    goBack(): void {
        if (this.dataSource().length > 0) {
            if (!confirm('¿Está seguro de salir? Hay items agregados no guardados.')) return;
        }
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }

    async openTraspasoHerramienta(): Promise<void> {
        const { TraspasoHerramientaComponent } = await import('./traspaso-herramienta/traspaso-herramienta.component');

        const dialogRef = this.dialog.open(TraspasoHerramientaComponent, {
            width: '900px',
            maxWidth: '95vw',
            height: '85vh',
            panelClass: 'neo-dialog',
            hasBackdrop: true,
            disableClose: false,
            autoFocus: false,
            data: { mode: 'add' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'agregar') {
                this.agregarHerramienta(result.data);
            }
        });
    }

    agregarHerramienta(data: any): void {
        const newItem: TransferItem = {
            toolId:       data.id_tool ?? 0,
            codigo:       data.codigo || '',
            partNumber:   data.pn     || '',
            serialNumber: data.sn     || '',
            unidad:       data.unidad || 'PZA',
            cantidad:     data.cantidad || 1,
            descripcion:  data.nombre  || data.descripcion || '',
            contenido:    data.observacion || '',
            marca:        data.marca   || '',
            fecha:        new Date().toISOString().split('T')[0],
            estadoFisico: data.estadoFisico || 'SERVICEABLE',
            selected:     false
        };

        this.dataSource.set([...this.dataSource(), newItem]);
        this.showMessage('Herramienta agregada al traspaso', 'success');
    }

    removerItem(index: number): void {
        const items = [...this.dataSource()];
        const removed = items.splice(index, 1)[0];
        this.dataSource.set(items);
        this.showMessage(`Se removió: ${removed.descripcion}`, 'info');
    }

    getTotalCantidad(): number {
        return this.dataSource().reduce((t, i) => t + (i.cantidad || 0), 0);
    }

    getFormErrors(): string[] {
        const errors: string[] = [];
        const f = this.transferForm;
        if (!f.get('nombreCompleto')?.value) errors.push('Nombre Completo');
        if (!f.get('nroLicencia')?.value)    errors.push('Nro. Licencia');
        if (!f.get('cargo')?.value)       errors.push('Cargo');
        if (!f.get('gerencia')?.value)    errors.push('Gerencia');
        if (!f.get('unidad')?.value)      errors.push('Unidad');
        if (!f.get('tipoTraspaso')?.value) errors.push('Tipo Traspaso');
        return errors;
    }

    hasError(field: string, error: string): boolean {
        const control = this.transferForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    private showMessage(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
        this.systemMsg     = message;
        this.systemMsgType = type;
        this.showSystemMsg = true;
        setTimeout(() => this.showSystemMsg = false, 4000);
    }
}
