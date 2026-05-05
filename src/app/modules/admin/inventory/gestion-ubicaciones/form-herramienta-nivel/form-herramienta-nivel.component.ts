import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { Level, LevelTool, Rack, ToolEstado } from '../interfaces';

type Mode = 'new' | 'edit';

interface DialogData {
    mode:  Mode;
    rack:  Rack;
    level: Level;
    tool?: LevelTool;
}

@Component({
    selector: 'app-form-herramienta-nivel',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatIconModule,
        MatTooltipModule,
        DragDropModule,
    ],
    templateUrl: './form-herramienta-nivel.component.html',
    styles: [`
        :host { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FF6A00; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e55a00; }
    `]
})
export class FormHerramientaNivelComponent implements OnInit {

    public dialogRef = inject(MatDialogRef<FormHerramientaNivelComponent>);
    private fb       = inject(FormBuilder);
    private data     = inject<DialogData>(MAT_DIALOG_DATA);

    mode: Mode = this.data.mode;
    rack:  Rack  = this.data.rack;
    level: Level = this.data.level;

    form!: FormGroup;
    selectedImage = signal<string | null>(null);

    unidadesMedida = [
        { value: 'UNIDAD', label: 'UNIDAD' }, { value: 'PAR', label: 'PAR' },
        { value: 'JUEGO',  label: 'JUEGO'  }, { value: 'KIT', label: 'KIT' },
        { value: 'LITRO',  label: 'LITRO'  }, { value: 'METRO', label: 'METRO' },
        { value: 'CAJA',   label: 'CAJA'   }, { value: 'KG', label: 'KG' },
    ];

    estados: { value: ToolEstado; label: string }[] = [
        { value: 'NUEVO',           label: 'NUEVO' },
        { value: 'REACONDICIONADO', label: 'REACONDICIONADO' },
        { value: 'USADO',           label: 'USADO' },
    ];

    ngOnInit(): void {
        const t = this.data.tool;
        if (t?.imagenBase64) this.selectedImage.set(t.imagenBase64);

        this.form = this.fb.group({
            codigo:        [t?.codigo  ?? 'BOA-H-', [Validators.required, Validators.maxLength(40)]],
            pn:            [t?.pn      ?? '',       [Validators.required, Validators.maxLength(60)]],
            sn:            [t?.sn      ?? ''],
            nombre:        [t?.nombre  ?? '',       [Validators.required, Validators.maxLength(150)]],
            marca:         [t?.marca   ?? '',       Validators.maxLength(60)],
            estado:        [t?.estado  ?? 'NUEVO',  Validators.required],
            um:            [t?.um      ?? 'UNIDAD', Validators.required],
            cantidad:      [t?.cantidad ?? 1,       [Validators.required, Validators.min(1)]],
            observaciones: [t?.observaciones ?? ''],
        });
    }

    get titulo(): string {
        return this.mode === 'new' ? 'Agregar Herramienta al Nivel' : 'Editar Herramienta';
    }

    generarCodigoBoa(): void {
        const rnd = Math.floor(1000 + Math.random() * 9000);
        this.form.patchValue({ codigo: `BOA-H-${rnd}` });
    }

    onImageSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => this.selectedImage.set(reader.result as string);
        reader.readAsDataURL(file);
    }

    hasError(field: string, error: string): boolean {
        const c = this.form.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    procesar(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const v = this.form.getRawValue();
        const out: LevelTool = {
            id:           this.data.tool?.id ?? 0,
            levelId:      this.level.id,
            rackId:       this.rack.id,
            rackCodigo:   this.rack.codigo,
            levelNumero:  this.level.numero,
            levelCodigo:  this.level.codigo,
            codigo:       v.codigo.trim(),
            pn:           v.pn.trim(),
            sn:           v.sn?.trim() || undefined,
            nombre:       v.nombre.trim(),
            marca:        v.marca?.trim() || undefined,
            estado:       v.estado,
            cantidad:     Number(v.cantidad),
            um:           v.um,
            imagenBase64: this.selectedImage() ?? undefined,
            observaciones: v.observaciones?.trim() || undefined,
        };

        this.dialogRef.close(out);
    }

    cerrar(): void { this.dialogRef.close(); }
}
