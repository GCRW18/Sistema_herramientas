import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
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
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        DragDropModule
    ],
    templateUrl: './form-cliente.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
        }
    `]
})
export class FormClienteComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<FormClienteComponent>, { optional: true });
    private dialog = inject(MatDialog);
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
            tipo_cliente:       ['', Validators.required],
            nombre:             ['', Validators.required],
            nit:                [''],
            razon_social:       [''],
            registro_fiscal:    [''],
            ciudad:             ['', Validators.required],
            pais:               ['Bolivia', Validators.required],
            direccion:          [''],
            telefono:           ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]+$/)]],
            email:              ['', [Validators.required, Validators.email]],
            contacto_principal: ['', Validators.required],
            telefono_contacto:  [''],
            email_contacto:     ['', Validators.email],
            observaciones:      ['']
        });
    }

    private setupValidationDynamic(): void {
        this.clienteForm.get('tipo_cliente')?.valueChanges.subscribe(tipo => {
            const razonSocialControl = this.clienteForm.get('razon_social');
            if (tipo === 'EMPRESA') {
                razonSocialControl?.setValidators([Validators.required]);
            } else {
                razonSocialControl?.clearValidators();
                razonSocialControl?.setValue('');
            }
            razonSocialControl?.updateValueAndValidity();
        });
    }

    async openClienteForm(tipo: 'EMPRESA' | 'PERSONA'): Promise<void> {
        const { TipoClienteFormDialogComponent } = await import('./tipo-cliente-form-dialog.component');
        const current = this.clienteForm.value;

        const ref = this.dialog.open(TipoClienteFormDialogComponent, {
            panelClass: 'neo-mini-dialog',
            hasBackdrop: true,
            backdropClass: 'bg-black/30',
            disableClose: true,
            data: {
                tipo,
                nombre:             current.nombre,
                nit:                current.nit,
                razon_social:       current.razon_social,
                registro_fiscal:    current.registro_fiscal,
                ciudad:             current.ciudad,
                pais:               current.pais,
                direccion:          current.direccion,
                email:              current.email,
                telefono:           current.telefono,
                contacto_principal: current.contacto_principal,
                telefono_contacto:  current.telefono_contacto,
                email_contacto:     current.email_contacto,
                observaciones:      current.observaciones
            }
        });

        ref.afterClosed().subscribe(result => {
            if (result) {
                this.clienteForm.patchValue({ tipo_cliente: tipo });
                this.clienteForm.patchValue(result);
            }
        });
    }

    private loadClienteData(cliente: any): void {
        this.clienteForm.patchValue(cliente, { emitEvent: false });
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
