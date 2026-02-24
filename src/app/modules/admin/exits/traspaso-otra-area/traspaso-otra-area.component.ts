import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

interface TransferItem {
    codigo: string;
    partNumber: string;
    serialNumber: string;
    unidad: string;
    cantidad: number;
    descripcion: string;
    contenido: string;
    marca: string;
    fecha: string;
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

        :host-context(.dark) .spinner-overlay {
            background: rgba(0,0,0,0.7);
        }

        ::ng-deep .white-checkbox .mdc-checkbox__background {
            border-color: white !important;
        }

        ::ng-deep .white-checkbox.mat-mdc-checkbox-checked .mdc-checkbox__background {
            background-color: white !important;
            border-color: white !important;
        }

        ::ng-deep .white-checkbox .mdc-checkbox__checkmark {
            color: #0f172a !important;
        }
    `]
})
export class TraspasoOtraAreaComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<TraspasoOtraAreaComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private router = inject(Router);

    transferForm!: FormGroup;
    isSaving = false;
    showConfirmModal = false;

    displayedColumns: string[] = [
        'select', 'fila', 'codigo', 'descripcion', 'partNumber', 'serialNumber',
        'unidadItem', 'cantidad', 'contenido', 'acciones'
    ];

    // System messages
    systemMsg = '';
    systemMsgType: 'success' | 'error' | 'info' | 'warning' = 'info';
    showSystemMsg = false;

    // Mock Data inicial
    dataSource = signal<TransferItem[]>([
        {
            codigo: 'BOA-H-001',
            partNumber: 'TRQ-2502D',
            serialNumber: 'TRQ-2024-001',
            unidad: 'PZA',
            cantidad: 2,
            descripcion: 'TORQUÍMETRO DIGITAL 50-250 IN-LB',
            contenido: 'INCLUYE MALETÍN Y BATERÍAS',
            marca: 'SNAP-ON',
            fecha: new Date().toISOString().split('T')[0],
            selected: false
        }
    ]);

    ngOnInit(): void {
        this.initForm();
    }

    private initForm(): void {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');

        this.transferForm = this.fb.group({
            buscar: [''],
            nombres: ['', Validators.required],
            apPaterno: ['', Validators.required],
            apMaterno: ['', Validators.required],
            nroLicencia: ['', Validators.required],
            cargo: ['', Validators.required],
            fecha: [today, Validators.required],
            hora: [`${hours}:${minutes}`, Validators.required],
            gerencia: ['', Validators.required],
            unidad: ['', Validators.required],
            base: ['VVI', Validators.required],
            departamento: [''],
            tipoTraspaso: ['TEMPORAL', Validators.required],
            observaciones: ['']
        });
    }

    // Selection methods
    toggleSelection(item: TransferItem): void {
        item.selected = !item.selected;
        this.dataSource.set([...this.dataSource()]);
    }

    toggleAllSelection(event: any): void {
        const checked = event.checked;
        const items = this.dataSource();
        items.forEach(item => item.selected = checked);
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
        return this.dataSource().filter(item => item.selected).reduce((total, item) => total + (item.cantidad || 0), 0);
    }

    buscarPersona(): void {
        const buscar = this.transferForm.get('buscar')?.value;
        if (!buscar) {
            this.showMessage('Ingrese un nombre o ID para buscar', 'info');
            return;
        }

        this.showMessage(`Buscando: ${buscar}...`, 'info');

        const mockPersonas = [
            { nombres: 'JUAN CARLOS', apPaterno: 'PEREZ', apMaterno: 'GONZALES', nroLicencia: 'BOA-001', cargo: 'TÉCNICO DE MANTENIMIENTO' },
            { nombres: 'MARIA ELENA', apPaterno: 'RODRIGUEZ', apMaterno: 'LOPEZ', nroLicencia: 'BOA-002', cargo: 'SUPERVISORA DE ALMACÉN' },
            { nombres: 'PEDRO ANTONIO', apPaterno: 'GARCIA', apMaterno: 'MARTINEZ', nroLicencia: 'BOA-003', cargo: 'JEFE DE HERRAMIENTAS' }
        ];

        const personaEncontrada = mockPersonas.find(p =>
            p.nombres.toLowerCase().includes(buscar.toLowerCase()) ||
            p.apPaterno.toLowerCase().includes(buscar.toLowerCase()) ||
            p.nroLicencia.toLowerCase().includes(buscar.toLowerCase())
        );

        if (personaEncontrada) {
            this.transferForm.patchValue(personaEncontrada);
            this.showMessage('Persona encontrada', 'success');
        } else {
            this.showMessage('No se encontró la persona', 'error');
        }
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
            this.showMessage(`Complete los campos requeridos: ${errors.length} error(es)`, 'error');
            return;
        }

        this.showConfirmModal = true;
    }

    closeConfirmModal(): void {
        this.showConfirmModal = false;
    }

    finalizar(): void {
        this.isSaving = true;

        setTimeout(() => {
            const formData = this.transferForm.value;
            const items = this.dataSource();

            console.log('Finalizando Traspaso:', { formData, items });

            this.isSaving = false;
            this.showConfirmModal = false;
            this.showMessage('Traspaso registrado exitosamente', 'success');

            if (this.dialogRef) {
                this.dialogRef.close({ form: formData, items: items });
            } else {
                this.router.navigate(['/salidas']);
            }
        }, 1500);
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
            codigo: data.codigo || `TRS-${this.dataSource().length + 1}`.padStart(3, '0'),
            partNumber: data.pn || 'N/A',
            serialNumber: data.sn || 'N/A',
            unidad: data.unidad || 'PZA',
            cantidad: data.cantidad || 1,
            descripcion: data.nombre || data.descripcion || 'Herramienta sin nombre',
            contenido: data.contenido || '',
            marca: data.marca || 'N/A',
            fecha: new Date().toISOString().split('T')[0],
            selected: false
        };

        const currentItems = this.dataSource();
        this.dataSource.set([...currentItems, newItem]);
        this.showMessage('Herramienta agregada al traspaso', 'success');
    }

    removerItem(index: number): void {
        const currentItems = this.dataSource();
        const removedItem = currentItems[index];
        currentItems.splice(index, 1);
        this.dataSource.set([...currentItems]);
        this.showMessage(`Se removió: ${removedItem.descripcion}`, 'info');
    }

    getTotalCantidad(): number {
        return this.dataSource().reduce((total, item) => total + (item.cantidad || 0), 0);
    }

    getFormErrors(): string[] {
        const errors: string[] = [];
        const form = this.transferForm;

        if (!form.get('nombres')?.value) errors.push('Nombres');
        if (!form.get('apPaterno')?.value) errors.push('Apellido Paterno');
        if (!form.get('apMaterno')?.value) errors.push('Apellido Materno');
        if (!form.get('nroLicencia')?.value) errors.push('Número de Licencia');
        if (!form.get('cargo')?.value) errors.push('Cargo');
        if (!form.get('fecha')?.value) errors.push('Fecha');
        if (!form.get('hora')?.value) errors.push('Hora');
        if (!form.get('gerencia')?.value) errors.push('Gerencia');
        if (!form.get('unidad')?.value) errors.push('Unidad');
        if (!form.get('base')?.value) errors.push('Base');
        if (!form.get('tipoTraspaso')?.value) errors.push('Tipo de Traspaso');

        return errors;
    }

    hasError(field: string, error: string): boolean {
        const control = this.transferForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    private showMessage(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
        this.systemMsg = message;
        this.systemMsgType = type;
        this.showSystemMsg = true;
        setTimeout(() => this.showSystemMsg = false, 4000);
    }
}
