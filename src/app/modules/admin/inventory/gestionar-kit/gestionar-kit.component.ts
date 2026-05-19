import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize } from 'rxjs/operators';
import { MovementService }          from '../../../../core/services/movement.service';
import { CalibrationService }       from '../../../../core/services/calibration.service';
import { GestionUbicacionesService } from '../gestion-ubicaciones/gestion-ubicaciones.service';
import { Warehouse, Rack, Level }   from '../gestion-ubicaciones/interfaces';

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
        :host { display: flex; flex-direction: column; }

        .neo-scrollbar::-webkit-scrollbar { width: 8px; }
        .neo-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .neo-scrollbar::-webkit-scrollbar-thumb { background: #0F172A; border: 2px solid #000; border-radius: 4px; }
        .neo-scrollbar::-webkit-scrollbar-thumb:hover { background: #000; }
        :host-context(.dark) .neo-scrollbar::-webkit-scrollbar-thumb { background: #fbbf24; border-color: #000; }

        @keyframes itemPopIn {
            0%   { opacity: 0; transform: translateY(-6px) scaleY(0.85); }
            60%  { opacity: 1; transform: translateY(2px) scaleY(1.02); }
            100% { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        .item-enter {
            animation: itemPopIn 0.28s cubic-bezier(0.34, 1.4, 0.64, 1) both;
        }
    `]
})
export class GestionarKitComponent implements OnInit, OnDestroy {

    kitForm: FormGroup;
    modoEdicion = false;

    readonly categorias = ['MANTENIMIENTO', 'LUBRICACION', 'FRENOS', 'CALIBRACION', 'GENERAL'];
    readonly estados    = ['COMPLETO', 'INCOMPLETO', 'EN USO', 'MANTENIMIENTO'];

    // ── Autocomplete funcionarios ──────────────────────────────────────
    responsableSuggestions: any[] = [];
    responsableLoading = false;
    showResponsableSuggestions = false;
    private _reqSearch$ = new Subject<string>();

    // ── Autocomplete herramientas ──────────────────────────────────────
    toolSearchValue   = '';
    toolSuggestions:  any[] = [];
    toolSearchLoading = false;
    showToolDropdown  = false;
    private _toolSearch$ = new Subject<string>();

    // ── Picker de ubicación ────────────────────────────────────────────
    pickerOpen    = false;
    pickerLoading = false;
    pickerTop     = 0;
    pickerLeft    = 0;
    warehouses:   Warehouse[] = [];
    racks:        Rack[]      = [];
    levels:       Level[]     = [];
    selWarehouse: Warehouse | null = null;
    selRack:      Rack | null      = null;

    private _subs = new Subscription();

    private fb               = inject(FormBuilder);
    public  dialogRef        = inject(MatDialogRef<GestionarKitComponent>);
    private dialogData       = inject<any>(MAT_DIALOG_DATA, { optional: true });
    private movementService  = inject(MovementService);
    private calibrationService = inject(CalibrationService);
    private ubicSvc          = inject(GestionUbicacionesService);

    constructor() {
        this.kitForm = this.fb.group({
            nombreKit:      ['', Validators.required],
            categoria:      ['GENERAL', Validators.required],
            estado:         ['COMPLETO', Validators.required],
            responsable:    [''],
            ubicacion:      [''],
            descripcionKit: [''],
            items:          this.fb.array([])
        });
    }

    ngOnInit(): void {
        if (this.dialogData?.mode === 'edit' && this.dialogData?.kit) {
            this.modoEdicion = true;
            const kit = this.dialogData.kit;
            this.kitForm.patchValue({
                nombreKit:      kit.nombre      ?? '',
                categoria:      kit.categoria   ?? 'GENERAL',
                estado:         kit.estado      ?? 'COMPLETO',
                responsable:    kit.responsable ?? '',
                ubicacion:      kit.ubicacion   ?? '',
                descripcionKit: kit.descripcion ?? ''
            });
            (kit.items ?? []).forEach((item: any) => {
                this.items.push(this._buildItemGroup(item.descripcion, item.codigoBoamm ?? item.codigo));
            });
        }

        // Búsqueda de funcionarios
        this._subs.add(
            this._reqSearch$.pipe(
                debounceTime(350),
                distinctUntilChanged(),
                switchMap(term => {
                    if (term.length < 2) {
                        this.responsableSuggestions     = [];
                        this.showResponsableSuggestions = false;
                        return of([]);
                    }
                    this.responsableLoading = true;
                    return this.movementService.getFuncionarios(term).pipe(
                        finalize(() => this.responsableLoading = false),
                        catchError(() => of([]))
                    );
                })
            ).subscribe(lista => {
                this.responsableSuggestions     = lista;
                this.showResponsableSuggestions = lista.length > 0;
            })
        );

        // Búsqueda de herramientas
        this._subs.add(
            this._toolSearch$.pipe(
                debounceTime(350),
                distinctUntilChanged(),
                switchMap(term => {
                    if (term.length < 2) {
                        this.toolSuggestions  = [];
                        this.showToolDropdown = false;
                        return of([]);
                    }
                    this.toolSearchLoading = true;
                    return this.calibrationService.searchToolsAutocomplete(term).pipe(
                        finalize(() => this.toolSearchLoading = false),
                        catchError(() => of([]))
                    );
                })
            ).subscribe(tools => {
                this.toolSuggestions  = tools;
                this.showToolDropdown = tools.length > 0;
            })
        );
    }

    ngOnDestroy(): void { this._subs.unsubscribe(); }

    // ── FormArray ──────────────────────────────────────────────────────
    get items(): FormArray { return this.kitForm.get('items') as FormArray; }

    private _buildItemGroup(descripcion = '', codigo = ''): FormGroup {
        return this.fb.group({
            descripcion: [descripcion, Validators.required],
            codigo:      [codigo,      Validators.required]
        });
    }

    agregarItemVacio(): void          { this.items.push(this._buildItemGroup()); }
    eliminarItem(i: number): void     { this.items.removeAt(i); }

    // ── Funcionarios ───────────────────────────────────────────────────
    onReqInput(event: Event): void {
        this._reqSearch$.next((event.target as HTMLInputElement).value);
    }

    seleccionarFuncionario(f: any): void {
        this.kitForm.get('responsable')?.setValue(f.nombre ?? f.full_name ?? '');
        this.showResponsableSuggestions = false;
        this.responsableSuggestions    = [];
    }

    ocultarFuncionarios(): void {
        setTimeout(() => this.showResponsableSuggestions = false, 150);
    }

    // ── Herramientas ───────────────────────────────────────────────────
    onToolInput(event: Event): void {
        this.toolSearchValue = (event.target as HTMLInputElement).value;
        this._toolSearch$.next(this.toolSearchValue.trim());
    }

    seleccionarHerramienta(tool: any): void {
        this.items.push(this._buildItemGroup(
            tool.name ?? tool.tool_name ?? '',
            tool.code ?? tool.tool_code ?? ''
        ));
        this.toolSearchValue  = '';
        this.toolSuggestions  = [];
        this.showToolDropdown = false;
    }

    ocultarTools(): void {
        setTimeout(() => this.showToolDropdown = false, 150);
    }

    // ── Picker de ubicación ────────────────────────────────────────────
    openPicker(event: MouseEvent): void {
        const btn    = event.currentTarget as HTMLElement;
        const rect   = btn.getBoundingClientRect();
        const panelW = 420;
        let left = rect.left;
        if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
        this.pickerTop  = rect.bottom + 6;
        this.pickerLeft = Math.max(8, left);
        this.pickerOpen    = true;
        this.pickerLoading = true;
        this.racks         = [];
        this.levels        = [];
        this.selWarehouse  = null;
        this.selRack       = null;
        this.ubicSvc.getWarehouses().subscribe({
            next:  ws => { this.warehouses = ws.filter(w => w.estado === 'ACTIVO'); this.pickerLoading = false; },
            error: () => { this.pickerLoading = false; }
        });
    }

    selectWarehouse(w: Warehouse): void {
        this.selWarehouse = w;
        this.selRack      = null;
        this.levels       = [];
        this.ubicSvc.getRacks(w.id).subscribe(rs => { this.racks = rs.filter(r => r.activo); });
    }

    selectRack(r: Rack): void {
        this.selRack = r;
        this.levels  = [];
        this.ubicSvc.getLevels(r.id).subscribe(ls => { this.levels = ls.filter(l => l.activo && !l.isFloor); });
    }

    selectLevel(l: Level): void {
        const etiqueta = `${this.selWarehouse!.nombre} › ${this.selRack!.nombre} › ${l.nombre}`;
        this.kitForm.patchValue({ ubicacion: etiqueta });
        this.pickerOpen = false;
    }

    clearUbicacion(): void {
        this.kitForm.patchValue({ ubicacion: '' });
        this.selWarehouse = null;
        this.selRack      = null;
        this.racks        = [];
        this.levels       = [];
    }

    // ── Submit ─────────────────────────────────────────────────────────
    cerrar(): void  { this.dialogRef.close(); }

    onSubmit(): void {
        if (this.kitForm.valid) this.dialogRef.close(this.kitForm.value);
    }

    // ── Helpers ────────────────────────────────────────────────────────
    getEstadoClass(estado: string): string {
        const m: Record<string, string> = {
            'COMPLETO':      'bg-green-100 text-green-800 border-green-800',
            'INCOMPLETO':    'bg-yellow-100 text-yellow-800 border-yellow-800',
            'EN USO':        'bg-blue-100 text-blue-800 border-blue-800',
            'MANTENIMIENTO': 'bg-purple-100 text-purple-800 border-purple-800'
        };
        return m[estado] ?? 'bg-stone-200 text-black border-black';
    }
}
