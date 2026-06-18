import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';

import { Level, LevelTool, Rack, ToolEstado } from '../interfaces';
import { CalibrationService } from 'app/core/services/calibration.service';
import { MovementService } from 'app/core/services/movement.service';

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
        MatProgressSpinnerModule,
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
export class FormHerramientaNivelComponent implements OnInit, OnDestroy {

    public dialogRef    = inject(MatDialogRef<FormHerramientaNivelComponent>);
    private fb          = inject(FormBuilder);
    private data        = inject<DialogData>(MAT_DIALOG_DATA);
    private calibSvc    = inject(CalibrationService);
    private movementSvc = inject(MovementService);
    private _destroy$   = new Subject<void>();
    private _search$    = new Subject<string>();

    mode: Mode = this.data.mode;
    rack:  Rack  = this.data.rack;
    level: Level = this.data.level;

    form!: FormGroup;
    selectedImage = signal<string | null>(null);

    /* ════════ Buscador header (mismo patrón que form-envio) ════════ */
    buscarValue       = 'BOA-H-';
    toolSuggestions:  any[] = [];
    showToolDropdown  = false;
    toolSearchLoading = false;

    unidadesMedida = [
        { value: 'UNIDAD', label: 'UNIDAD' }, { value: 'PAR',   label: 'PAR'   },
        { value: 'JUEGO',  label: 'JUEGO'  }, { value: 'KIT',   label: 'KIT'   },
        { value: 'LITRO',  label: 'LITRO'  }, { value: 'METRO', label: 'METRO' },
        { value: 'CAJA',   label: 'CAJA'   }, { value: 'KG',    label: 'KG'    },
    ];

    estados: { value: ToolEstado; label: string }[] = [
        { value: 'NUEVO',           label: 'NUEVO'           },
        { value: 'REACONDICIONADO', label: 'REACONDICIONADO' },
        { value: 'USADO',           label: 'USADO'           },
    ];

    tiposHerramienta: { value: string; label: string }[] = [];

    nivelesCriticidad = [
        { value: 'A', label: 'A — Crítico'   },
        { value: 'B', label: 'B — Importante' },
        { value: 'C', label: 'C — Menor'      },
    ];

    origenesFabricacion = [
        { value: 'INTERNACIONAL', label: 'Internacional' },
        { value: 'NACIONAL',      label: 'Nacional'      },
    ];

    ngOnInit(): void {
        const t = this.data.tool;
        if (t?.imagenBase64) this.selectedImage.set(t.imagenBase64);

        this.form = this.fb.group({
            codigo:               [t?.codigo             ?? 'BOA-H-',       [Validators.required, Validators.maxLength(40)]],
            pn:                   [t?.pn                 ?? '',               [Validators.required, Validators.maxLength(60)]],
            sn:                   [t?.sn                 ?? ''],
            nombre:               [t?.nombre             ?? '',               [Validators.required, Validators.maxLength(150)]],
            marca:                [t?.marca              ?? '',               Validators.maxLength(60)],
            tipo:                 [t?.tipo               ?? 'HERRAMIENTA',   Validators.required],
            estado:               [t?.estado             ?? 'NUEVO',         Validators.required],
            um:                   [t?.um                 ?? 'UNIDAD',        Validators.required],
            cantidad:             [t?.cantidad           ?? 1,               [Validators.required, Validators.min(1)]],
            nivelCriticidad:      [t?.nivelCriticidad    ?? 'B',             Validators.required],
            fabricacion:          [t?.fabricacion        ?? 'INTERNACIONAL', Validators.required],
            requiereCalibracion:  [t?.requiereCalibracion ?? false],
            intervaloCalibracion: [t?.intervaloCalibracion ?? null],
            fechaCalibracion:     [t?.fechaCalibracion   ?? null],
            nroCertificado:       [t?.nroCertificado     ?? ''],
            observaciones:        [t?.observaciones      ?? ''],
        });

        this.movementSvc.getIngresosCategories().pipe(
            takeUntil(this._destroy$)
        ).subscribe(cats => {
            this.tiposHerramienta = cats
                .filter(c => c.active)
                .map(c => ({ value: c.code, label: c.name }));
        });

        this.form.get('requiereCalibracion')?.valueChanges.pipe(
            takeUntil(this._destroy$)
        ).subscribe(requiere => {
            const ctrl = this.form.get('intervaloCalibracion');
            if (requiere) {
                ctrl?.setValidators([Validators.required, Validators.min(1)]);
            } else {
                ctrl?.clearValidators();
                this.form.patchValue({ intervaloCalibracion: null, fechaCalibracion: null, nroCertificado: '' });
            }
            ctrl?.updateValueAndValidity();
        });

        this._setupSearch();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    /* ════════ Buscador ════════ */

    private _setupSearch(): void {
        this._search$.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => {
                const q = term.replace(/^BOA-H-/i, '').trim();
                if (q.length < 1) {
                    this.showToolDropdown = false;
                    return of([]);
                }
                this.toolSearchLoading = true;
                return this.calibSvc.searchToolsAutocomplete(term).pipe(
                    finalize(() => this.toolSearchLoading = false)
                );
            }),
            takeUntil(this._destroy$)
        ).subscribe(results => {
            this.toolSuggestions  = results || [];
            this.showToolDropdown = this.toolSuggestions.length > 0;
        });
    }

    onBuscarInput(value: string): void {
        this._search$.next(value.trim());
    }

    seleccionarHerramienta(tool: any): void {
        const codigo = tool.code ?? tool.tool_code ?? 'BOA-H-';
        this.buscarValue      = codigo;
        this.showToolDropdown = false;
        this.form.patchValue({
            codigo: codigo,
            pn:     tool.part_number   ?? tool.model       ?? tool.pn ?? '',
            sn:     tool.serial_number ?? tool.sn          ?? '',
            nombre: tool.name          ?? tool.tool_name   ?? '',
            marca:  tool.brand         ?? tool.marca       ?? '',
        });
    }

    hideBuscarDropdown(): void {
        setTimeout(() => this.showToolDropdown = false, 180);
    }

    /* ════════ Form ════════ */

    get titulo(): string {
        return this.mode === 'new' ? 'Agregar Herramienta al Nivel' : 'Editar Herramienta';
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
            id:                   this.data.tool?.id ?? 0,
            levelId:              this.level.id,
            rackId:               this.rack.id,
            rackCodigo:           this.rack.codigo,
            levelNumero:          this.level.numero,
            levelCodigo:          this.level.codigo,
            codigo:               v.codigo.trim(),
            pn:                   v.pn.trim(),
            sn:                   v.sn?.trim()            || undefined,
            nombre:               v.nombre.trim(),
            marca:                v.marca?.trim()         || undefined,
            tipo:                 v.tipo,
            estado:               v.estado,
            cantidad:             Number(v.cantidad),
            um:                   v.um,
            nivelCriticidad:      v.nivelCriticidad,
            fabricacion:          v.fabricacion,
            requiereCalibracion:  v.requiereCalibracion ?? false,
            intervaloCalibracion: v.requiereCalibracion ? v.intervaloCalibracion : null,
            fechaCalibracion:     v.requiereCalibracion ? v.fechaCalibracion     : null,
            nroCertificado:       v.requiereCalibracion ? v.nroCertificado       : '',
            imagenBase64:         this.selectedImage()    ?? undefined,
            observaciones:        v.observaciones?.trim() || undefined,
        };
        this.dialogRef.close(out);
    }

    cerrar(): void { this.dialogRef.close(); }
}
