import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';

@Component({
    selector: 'app-gestionar-kit',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatIconModule,
        DragDropModule,
        MatDialogModule
    ],
    templateUrl: './gestionar-kit.component.html',
    styles: [`
        :host {
            display: flex;
            flex-direction: column;
        }

        /* Custom Scrollbar adaptada para modo claro y oscuro */
        .neo-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        .neo-scrollbar::-webkit-scrollbar-track {
            background: #e7e5e4;
            border-left: 2px solid #000;
        }
        .neo-scrollbar::-webkit-scrollbar-thumb {
            background: #0F172A;
            border: 2px solid #000;
            border-radius: 4px;
        }
        .neo-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #000;
        }

        /* Dark mode overrides para la barra de desplazamiento */
        :host-context(.dark) .neo-scrollbar::-webkit-scrollbar-track {
            background: #1e293b;
        }
        :host-context(.dark) .neo-scrollbar::-webkit-scrollbar-thumb {
            background: #fbbf24;
            border-color: #000;
        }
    `]
})
export class GestionarKitComponent {
    kitForm: FormGroup;
    private fb = inject(FormBuilder);
    public dialogRef = inject(MatDialogRef<GestionarKitComponent>);

    constructor() {
        this.kitForm = this.fb.group({
            nombreKit: ['', Validators.required],
            descripcionKit: [''],
            ubicacion: [''],
            items: this.fb.array([])
        });
    }

    get items(): FormArray {
        return this.kitForm.get('items') as FormArray;
    }

    createItem(): FormGroup {
        return this.fb.group({
            descripcion: ['', Validators.required],
            codigo: ['', Validators.required],
            ubicacion: ['']
        });
    }

    agregarItem(): void {
        this.items.push(this.createItem());
    }

    eliminarItem(i: number): void {
        this.items.removeAt(i);
    }

    cerrar(): void {
        this.dialogRef.close();
    }

    onSubmit(): void {
        if (this.kitForm.valid) {
            this.dialogRef.close(this.kitForm.value);
        }
    }
}
