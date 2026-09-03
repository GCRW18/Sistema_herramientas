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

import { lastValueFrom } from 'rxjs';
import { Level, LevelTool, Rack, ToolEstado } from '../interfaces';
import { CalibrationService } from 'app/core/services/calibration.service';
import { MovementService } from 'app/core/services/movement.service';
import { BlobStorageService } from 'app/core/services/blob-storage.service';

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
    private blobStorage = inject(BlobStorageService);
    private _destroy$   = new Subject<void>();
    private _search$    = new Subject<string>();

    mode: Mode = this.data.mode;
    rack:  Rack  = this.data.rack;
    level: Level = this.data.level;

    form!: FormGroup;
    selectedImage = signal<string | null>(null);       // src YA resuelto para el <img> de preview
    private selectedImageFile: File | null = null;     // archivo nuevo a subir al Blob Storage
    private existingPhotoRef: string | null = null;    // ruta_bs/base64 ya guardada (se reenvía si no se cambia)
    guardando = signal(false);

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
        if (t?.imagenBase64) {
            this.existingPhotoRef = t.imagenBase64;
            this.selectedImage.set(this.blobStorage.resolveImageSrc(t.imagenBase64));
        }

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
            listaContenido:       [t?.listaContenido     ?? ''],
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

    /** Traduce condition (inglés: new/used/refurbished) a los valores de `estados`
     *  de este form (NUEVO/USADO/REACONDICIONADO). */
    private _conditionMap: Record<string, string> = {
        new: 'NUEVO', NUEVO: 'NUEVO',
        used: 'USADO', USADO: 'USADO',
        refurbished: 'REACONDICIONADO', REACONDICIONADO: 'REACONDICIONADO',
    };

    seleccionarHerramienta(tool: any): void {
        const codigo = tool.code ?? tool.tool_code ?? 'BOA-H-';
        this.buscarValue      = codigo;
        this.showToolDropdown = false;

        const estado          = this._conditionMap[tool.condition];
        const um               = this.unidadesMedida.some(u => u.value === tool.unit_of_measure) ? tool.unit_of_measure : undefined;
        const nivelCriticidad  = this.nivelesCriticidad.some(n => n.value === tool.criticality_level) ? tool.criticality_level : undefined;
        const fabricacion      = this.origenesFabricacion.some(f => f.value === tool.manufacture_origin) ? tool.manufacture_origin : undefined;
        const requiereCalib    = tool.requires_calibration === true || tool.requires_calibration === 't';

        this.form.patchValue({
            codigo:               codigo,
            pn:                   tool.part_number   ?? tool.model       ?? tool.pn ?? '',
            sn:                   tool.serial_number ?? tool.sn          ?? '',
            nombre:               tool.name          ?? tool.tool_name   ?? '',
            marca:                tool.brand         ?? tool.marca       ?? '',
            estado:               estado              ?? this.form.get('estado')?.value,
            um:                   um                  ?? this.form.get('um')?.value,
            cantidad:             tool.quantity_in_stock ? Number(tool.quantity_in_stock) : this.form.get('cantidad')?.value,
            nivelCriticidad:      nivelCriticidad     ?? this.form.get('nivelCriticidad')?.value,
            fabricacion:          fabricacion         ?? this.form.get('fabricacion')?.value,
            requiereCalibracion:  requiereCalib,
            intervaloCalibracion: tool.calibration_interval ? Number(tool.calibration_interval) : null,
            fechaCalibracion:     tool.next_calibration_date || null,
            nroCertificado:       tool.calibration_certificate || '',
            observaciones:        tool.notes || '',
            listaContenido:       tool.content_list || '',
        });

        if (tool.location_photo) {
            this.existingPhotoRef = tool.location_photo;
            this.selectedImage.set(this.blobStorage.resolveImageSrc(tool.location_photo));
        }
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
        if (file.size > 8 * 1024 * 1024) { return; }
        this.selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = () => this.selectedImage.set(reader.result as string); // solo preview
        reader.readAsDataURL(file);
    }

    hasError(field: string, error: string): boolean {
        const c = this.form.get(field);
        return !!c && c.hasError(error) && c.touched;
    }

    async procesar(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const v = this.form.getRawValue();

        // La foto se sube al Blob Storage; a HE_LTL_INS/MOD se manda la ruta_bs
        // (el campo sigue llamándose image_base64 por compatibilidad del contrato).
        let fotoRef: string | undefined = this.existingPhotoRef ?? undefined;
        if (this.selectedImageFile) {
            this.guardando.set(true);
            try {
                const seedId = this.data.tool?.id || v.codigo.trim();
                fotoRef = await lastValueFrom(this.blobStorage.upload(this.selectedImageFile, 'Imagenes', seedId));
            } catch (e: any) {
                this.guardando.set(false);
                this.form.markAllAsTouched();
                alert('No se pudo subir la foto: ' + (e?.message || 'error') + '. Intente de nuevo.');
                return;
            }
            this.guardando.set(false);
        }

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
            imagenBase64:         fotoRef,
            observaciones:        v.observaciones?.trim() || undefined,
            listaContenido:       v.listaContenido?.trim() || undefined,
        };
        this.dialogRef.close(out);
    }

    cerrar(): void { this.dialogRef.close(); }
}
