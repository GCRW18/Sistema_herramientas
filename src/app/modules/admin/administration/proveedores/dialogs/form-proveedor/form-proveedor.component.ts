import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

export interface FormProveedorData {
    proveedor?: any;
    mode?: 'create' | 'edit';
}

@Component({
    selector: 'app-form-proveedor',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './form-proveedor.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        /* Clases de utilidad para inputs Neo-Brutalistas */
        .neo-input {
            width: 100%;
            height: 48px;
            padding: 0 16px;
            background-color: #f9fafb;
            border: 3px solid #000;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            color: #1f2937;
            transition: all 0.2s;
        }

        .neo-input:focus {
            outline: none;
            box-shadow: 4px 4px 0px 0px #059669; /* Emerald shadow */
            transform: translateY(-2px);
            border-color: #000;
        }

        /* Dark mode overrides for inputs */
        :host-context(.dark) .neo-input {
            background-color: #334155;
            color: white;
            border-color: #94a3b8;
        }

        :host-context(.dark) .neo-input:focus {
            border-color: #34d399;
            box-shadow: 4px 4px 0px 0px #34d399;
        }

        /* Labels */
        .field-label {
            display: block;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 6px;
            margin-left: 4px;
        }

        :host-context(.dark) .field-label {
            color: #cbd5e1;
        }

        textarea.neo-input {
            height: auto;
            padding-top: 12px;
            padding-bottom: 12px;
        }
    `]
})
export class FormProveedorComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormProveedorComponent>, { optional: true });
    proveedorForm!: FormGroup;
    isEditMode = false;

    tiposProveedor = [
        { value: 'HERRAMIENTAS', label: 'Herramientas' },
        { value: 'CALIBRACION', label: 'Calibración' },
        { value: 'REPARACION', label: 'Reparación' },
        { value: 'MIXTO', label: 'Mixto' }
    ];

    constructor(
        private fb: FormBuilder,
        private router: Router,
        @Optional() @Inject(MAT_DIALOG_DATA) public data: FormProveedorData
    ) {}

    ngOnInit(): void {
        this.initForm();
        if (this.data?.proveedor && this.data?.mode === 'edit') {
            this.isEditMode = true;
            this.loadProveedorData(this.data.proveedor);
        }
    }

    private initForm(): void {
        this.proveedorForm = this.fb.group({
            codigo: ['', Validators.required],
            nombre_comercial: ['', Validators.required],
            razon_social: ['', Validators.required],
            nit: ['', Validators.required],
            tipo_proveedor: ['HERRAMIENTAS', Validators.required],
            direccion: [''],
            ciudad: ['', Validators.required],
            pais: ['Bolivia', Validators.required],
            telefono: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]+$/)]],
            email: ['', [Validators.required, Validators.email]],
            contacto_principal: ['', Validators.required],
            telefono_contacto: [''],
            email_contacto: ['', Validators.email],
            sitio_web: ['', Validators.pattern(/^https?:\/\/.+/)],
            calificacion: [0, [Validators.min(0), Validators.max(5)]],
            condiciones_pago: [''],
            tiempo_entrega_dias: [0, Validators.min(0)],
            observaciones: ['']
        });
    }

    private loadProveedorData(proveedor: any): void {
        this.proveedorForm.patchValue(proveedor);
    }

    // Helper para las estrellas de calificación
    setRating(rating: number): void {
        this.proveedorForm.patchValue({ calificacion: rating });
        this.proveedorForm.markAsDirty();
    }

    onSubmit(): void {
        if (this.proveedorForm.valid) {
            this.closeOrNavigate(this.proveedorForm.value);
        } else {
            this.proveedorForm.markAllAsTouched();
        }
    }

    onCancel(): void {
        this.closeOrNavigate();
    }

    goBack(): void {
        this.closeOrNavigate();
    }

    private closeOrNavigate(result?: any): void {
        if (this.dialogRef) {
            this.dialogRef.close(result);
        } else {
            this.router.navigate(['/administration/proveedores']);
        }
    }
}
