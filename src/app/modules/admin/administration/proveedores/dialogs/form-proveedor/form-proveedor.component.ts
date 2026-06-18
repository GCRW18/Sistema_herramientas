import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
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
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './form-proveedor.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }

        .neo-input {
            width: 100%; height: 40px; padding: 0 12px;
            background-color: #f9fafb; border: 2px solid #000;
            border-radius: 8px; font-weight: 900; font-size: 12px;
            color: #1f2937; transition: all 0.15s; appearance: auto;
            text-transform: uppercase;
        }
        .neo-input::placeholder { font-weight: 700; text-transform: none; color: #9ca3af; }
        .neo-input:focus { outline: none; box-shadow: 3px 3px 0px 0px #000; transform: translateY(-1px); border-color: #000; }
        :host-context(.dark) .neo-input { background-color: #1e293b; color: white; border-color: #475569; }
        :host-context(.dark) .neo-input::placeholder { color: #64748b; }
        :host-context(.dark) .neo-input:focus { border-color: #475569; }
        .field-label { display: block; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; margin-left: 2px; letter-spacing: 0.05em; }
        :host-context(.dark) .field-label { color: #94a3b8; }
    `]
})
export class FormProveedorComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormProveedorComponent>, { optional: true });
    private dialog = inject(MatDialog);
    proveedorForm!: FormGroup;
    isEditMode = false;

    async openUbicacionDialog(): Promise<void> {
        const { UbicacionContactoDialogComponent } = await import('./ubicacion-contacto-dialog.component');
        const ref = this.dialog.open(UbicacionContactoDialogComponent, {
            panelClass: 'neo-mini-dialog',
            hasBackdrop: true,
            backdropClass: 'bg-black/20',
            data: {
                ciudad:             this.proveedorForm.get('ciudad')?.value,
                pais:               this.proveedorForm.get('pais')?.value,
                direccion:          this.proveedorForm.get('direccion')?.value,
                contacto_principal: this.proveedorForm.get('contacto_principal')?.value,
                telefono_contacto:  this.proveedorForm.get('telefono_contacto')?.value,
                email_contacto:     this.proveedorForm.get('email_contacto')?.value,
                sitio_web:          this.proveedorForm.get('sitio_web')?.value
            }
        });
        ref.afterClosed().subscribe(result => {
            if (result) {
                this.proveedorForm.patchValue(result);
            }
        });
    }

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
            codigo:             [''],
            nombre_comercial:   ['', Validators.required],
            razon_social:       [''],
            nit:                ['', Validators.required],
            tipo_proveedor:     ['HERRAMIENTAS', Validators.required],
            direccion:          [''],
            ciudad:             [''],
            pais:               ['Bolivia'],
            telefono:           ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]+$/)]],
            email:              ['', [Validators.required, Validators.email]],
            contacto_principal: [''],
            telefono_contacto:  [''],
            email_contacto:     [''],
            sitio_web:          [''],
            calificacion:       [0, [Validators.min(0), Validators.max(5)]],
            condiciones_pago:   [''],
            tiempo_entrega_dias:[0, Validators.min(0)],
            observaciones:      ['']
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
