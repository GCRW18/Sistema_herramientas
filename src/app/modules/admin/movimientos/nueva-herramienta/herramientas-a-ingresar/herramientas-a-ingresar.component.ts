import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';

@Component({
    selector: 'app-herramientas-a-ingresar',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatTooltipModule,
        MatDialogModule,
        FormsModule,
        ReactiveFormsModule,
        DragDropModule
    ],
    templateUrl: './herramientas-a-ingresar.component.html',
    styles: [`
        :host {
            display: block;
            width: 100%;
            height: 100%;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }

        .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    `]
})
export class HerramientasAIngresarComponent implements OnInit, OnDestroy {
    public dialogRef  = inject(MatDialogRef<HerramientasAIngresarComponent>, { optional: true });
    public data       = inject(MAT_DIALOG_DATA, { optional: true });
    private fb        = inject(FormBuilder);
    private destroy$  = new Subject<void>();

    ingresoForm!: FormGroup;
    selectedImage  = signal<string | null>(null);

    unidadesMedida = [
        { value: 'UNIDAD', label: 'UNIDAD' }, { value: 'PAR', label: 'PAR' },
        { value: 'JUEGO', label: 'JUEGO' }, { value: 'KIT', label: 'KIT' },
        { value: 'LITRO', label: 'LITRO' }, { value: 'METRO', label: 'METRO' }
    ];

    estados = [
        { value: 'NUEVO', label: 'NUEVO' },
        { value: 'REACONDICIONADO', label: 'REACONDICIONADO' },
        { value: 'USADO', label: 'USADO' }
    ];

    ngOnInit(): void {
        this.ingresoForm = this.fb.group({
            codigo:         ['BOA-H-', [Validators.required]],
            pn:             ['', Validators.required],
            sn:             [''],
            nombre:         ['', Validators.required],
            marca:          ['', Validators.required],
            estado:         ['NUEVO', Validators.required],
            um:             ['UNIDAD', Validators.required],
            estante:        [''],
            nivelUbicacion: [''],
            cantidad:       [1, [Validators.required, Validators.min(1)]],
            observaciones:  ['']
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    generarCodigoBoa(): void {
        const randomStr = Math.floor(1000 + Math.random() * 9000);
        this.ingresoForm.patchValue({ codigo: `BOA-H-${randomStr}` });
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => this.selectedImage.set(reader.result as string);
            reader.readAsDataURL(file);
        }
    }

    procesar(): void {
        this.ingresoForm.markAllAsTouched();
        if (this.ingresoForm.invalid) {
            return;
        }

        const data = {
            ...this.ingresoForm.value,
            imagenBase64: this.selectedImage()
        };
        this.dialogRef?.close({ action: 'procesar', data });
    }

    cerrar(): void {
        this.dialogRef?.close();
    }

    hasError(field: string, error: string): boolean {
        const control = this.ingresoForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }
}
