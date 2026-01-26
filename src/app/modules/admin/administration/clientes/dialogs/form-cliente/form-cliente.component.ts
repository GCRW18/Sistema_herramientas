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

export interface FormClienteData {
    cliente?: any;
    mode?: 'create' | 'edit';
}

@Component({
    selector: 'app-form-cliente',
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
    templateUrl: './form-cliente.component.html',
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
            box-shadow: 4px 4px 0px 0px #f59e0b; /* Amber shadow */
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
            border-color: #fbbf24;
            box-shadow: 4px 4px 0px 0px #fbbf24;
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
    `]
})
export class FormClienteComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormClienteComponent>, { optional: true });
    clienteForm!: FormGroup;
    isEditMode = false;

    constructor(
        private fb: FormBuilder,
        private router: Router,
        @Optional() @Inject(MAT_DIALOG_DATA) public data: FormClienteData
    ) {}

    ngOnInit(): void {
        this.initForm();
        this.setupValidationDynamic();
        if (this.data?.cliente && this.data?.mode === 'edit') {
            this.isEditMode = true;
            this.loadClienteData(this.data.cliente);
        }
    }

    private initForm(): void {
        this.clienteForm = this.fb.group({
            tipo_cliente: ['EMPRESA', Validators.required],
            nombre: ['', Validators.required],
            razon_social: [''],
            nit: [''],
            registro_fiscal: [''],
            direccion: [''],
            ciudad: ['', Validators.required],
            pais: ['Bolivia', Validators.required],
            telefono: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]+$/)]],
            email: ['', [Validators.required, Validators.email]],
            contacto_principal: ['', Validators.required],
            telefono_contacto: [''],
            email_contacto: ['', Validators.email],
            observaciones: ['']
        });
    }

    private setupValidationDynamic(): void {
        this.clienteForm.get('tipo_cliente')?.valueChanges.subscribe(tipo => {
            const razonSocialControl = this.clienteForm.get('razon_social');
            if (tipo === 'EMPRESA') {
                razonSocialControl?.setValidators([Validators.required]);
            } else {
                razonSocialControl?.clearValidators();
                razonSocialControl?.setValue(''); // Limpiar si cambia a persona
            }
            razonSocialControl?.updateValueAndValidity();
        });
    }

    // Método helper para cambiar el tipo desde las tarjetas visuales
    setClientType(type: 'EMPRESA' | 'PERSONA'): void {
        this.clienteForm.patchValue({ tipo_cliente: type });
    }

    private loadClienteData(cliente: any): void {
        this.clienteForm.patchValue(cliente);
    }

    onSubmit(): void {
        if (this.clienteForm.valid) {
            this.closeOrNavigate(this.clienteForm.value);
        } else {
            this.clienteForm.markAllAsTouched();
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
            this.router.navigate(['/administration/clientes']);
        }
    }
}
