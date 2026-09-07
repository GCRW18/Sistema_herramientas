import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Subject, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, map, finalize, catchError } from 'rxjs/operators';
import { MovementService } from '../../../../../core/services/movement.service';
import { SupplierService } from '../../../../../core/services/supplier.service';

interface Proveedor {
    nombre: string;
    nit?: string;
    contacto?: string;
    telefono?: string;
}

export interface DatosRecepcionData {
    form: FormGroup;
}

@Component({
    selector: 'app-datos-recepcion',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule,
        MatIconModule, MatTooltipModule, DragDropModule,
    ],
    templateUrl: './datos-recepcion.component.html',
    styles: [`
        :host { display: block; width: 100%; height: auto; max-height: 94vh; }
        .custom-scrollbar-ing::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar-ing::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-ing::-webkit-scrollbar-thumb { background: #D97706; border-radius: 3px; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
    `]
})
export class DatosRecepcionComponent implements OnInit, OnDestroy {
    public  dialogRef = inject(MatDialogRef<DatosRecepcionComponent>, { optional: true });
    public  data      = inject<DatosRecepcionData>(MAT_DIALOG_DATA, { optional: true });
    private movementSvc = inject(MovementService);
    private supplierSvc = inject(SupplierService);
    private destroy$  = new Subject<void>();

    recepcionForm!: FormGroup;

    /* ════════ Proveedor ════════ */
    proveedores:          Proveedor[] = [];
    proveedoresFiltrados: Proveedor[] = [];
    proveedorInput        = '';
    showProveedorDropdown = false;
    proveedorSeleccionado: Proveedor | null = null;

    /* ════════ Funcionario que recibe ════════ */
    _funcSearch$  = new Subject<string>();
    funcFiltrados: { id: string; nombre: string; cargo: string }[] = [];
    funcLoading   = false;
    showFuncDropdown = false;

    /* ════════ Recibí conforme (transferencia) ════════ */
    _recibiConformeSearch$    = new Subject<string>();
    recibiConformeFiltrados:    { id: string; nombre: string; cargo: string }[] = [];
    recibiConformeLoading     = false;
    showRecibiConformeDropdown = false;

    ngOnInit(): void {
        this.recepcionForm = this.data!.form;

        this.supplierSvc.getSuppliers().pipe(takeUntil(this.destroy$))
            .subscribe({ next: (data: any[]) => {
                this.proveedores = data.map((s: any) => ({
                    nombre:   s.name ?? '',
                    nit:      s.taxId ?? s.tax_id ?? '',
                    contacto: s.contactPerson ?? s.contact_person ?? '',
                    telefono: s.phone ?? ''
                }));
                this.proveedoresFiltrados = [...this.proveedores];
            }});

        // Reflejar selección previa del proveedor (si el formulario ya traía valor)
        this.proveedorInput = this.recepcionForm.get('proveedor')?.value || '';

        this._crearBuscadorFuncionario(
            this._funcSearch$,
            v => this.funcLoading = v,
            v => this.funcFiltrados = v,
            v => this.showFuncDropdown = v
        );
        this._crearBuscadorFuncionario(
            this._recibiConformeSearch$,
            v => this.recibiConformeLoading = v,
            v => this.recibiConformeFiltrados = v,
            v => this.showRecibiConformeDropdown = v
        );

        this.recepcionForm.get('tipoDe')?.valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.recepcionForm.patchValue({ nroCmr: '' });
                this.recepcionForm.patchValue({ recibiConforme: '' });
            });

        if (!this.recepcionForm.get('nroCmr')?.value) {
            this.generarNroCmr();
        }

        // Prellena "Funcionario que recibe" con el usuario logueado (editable) si viene vacío.
        if (this.recepcionForm.get('funcionarioRecibe') && !this.recepcionForm.get('funcionarioRecibe')?.value) {
            const currentUser = this._currentUserName();
            if (currentUser) this.recepcionForm.patchValue({ funcionarioRecibe: currentUser });
        }
    }

    private _currentUserName(): string {
        try {
            const auth = JSON.parse(localStorage.getItem('aut') || '{}');
            return auth.nombre_usuario || '';
        } catch { return ''; }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private _crearBuscadorFuncionario(
        search$: Subject<string>,
        setLoading: (v: boolean) => void,
        setItems:   (v: any[])   => void,
        setShow:    (v: boolean) => void
    ): void {
        search$.pipe(
            debounceTime(200), distinctUntilChanged(),
            switchMap(t => {
                if (t.length < 2) { setShow(false); return of([]); }
                setLoading(true);
                const q = t.toLowerCase();
                return this.movementSvc.getPersonal().pipe(
                    map((lista: any[]) => lista
                        .filter(f => [f.nombreCompleto, f.nombre, f.apellido_paterno, f.apellido_materno]
                            .filter(Boolean).join(' ').toLowerCase().includes(q))
                        .slice(0, 10)
                        .map(f => ({
                            id:     String(f.id_employee || f.id),
                            nombre: f.nombreCompleto || `${f.nombre || ''} ${f.apellido_paterno || ''}`.trim(),
                            cargo:  f.cargo || ''
                        }))),
                    finalize(() => setLoading(false)),
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(res => { setItems(res || []); setShow((res || []).length > 0); });
    }

    generarNroCmr(): void {
        const tipo = this.recepcionForm.get('tipoDe')?.value || 'COMPRA';
        const prefijos: Record<string, string> = { 'COMPRA': 'CMR', 'DONACION': 'DON', 'TRANSFERENCIA': 'TRANS' };
        this.movementSvc.getSiguienteCorrelativoPreview(prefijos[tipo] || 'CMR')
            .pipe(takeUntil(this.destroy$))
            .subscribe(num => this.recepcionForm.patchValue({ nroCmr: num }));
    }

    onProveedorInput(val: string): void {
        this.proveedorInput = val;
        this.recepcionForm.patchValue({ proveedor: val });
        this.proveedorSeleccionado = null;
        this._filtrarProveedores(val);
        this.showProveedorDropdown = val.length > 0 && this.proveedoresFiltrados.length > 0;
    }

    selectProveedor(p: Proveedor): void {
        this.proveedorInput = p.nombre;
        this.recepcionForm.patchValue({ proveedor: p.nombre });
        this.proveedorSeleccionado = p;
        this.showProveedorDropdown = false;
    }

    hideProveedorDropdown(): void { setTimeout(() => this.showProveedorDropdown = false, 150); }

    private _filtrarProveedores(v: string): void {
        if (!v) { this.proveedoresFiltrados = [...this.proveedores]; return; }
        const q = v.toLowerCase();
        this.proveedoresFiltrados = this.proveedores.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            (p.nit && p.nit.toLowerCase().includes(q)) ||
            (p.contacto && p.contacto.toLowerCase().includes(q))
        );
    }

    onFuncionarioInput(val: string): void {
        this.recepcionForm.patchValue({ funcionarioRecibe: val });
        this._funcSearch$.next(val);
    }

    selectFuncionario(f: { id: string; nombre: string; cargo: string }): void {
        this.recepcionForm.patchValue({ funcionarioRecibe: f.nombre });
        this.showFuncDropdown = false;
    }

    hideFuncDropdown(): void { setTimeout(() => this.showFuncDropdown = false, 150); }

    onRecibiConformeInput(val: string): void {
        this.recepcionForm.patchValue({ recibiConforme: val });
        this._recibiConformeSearch$.next(val);
    }

    selectRecibiConforme(f: { id: string; nombre: string; cargo: string }): void {
        this.recepcionForm.patchValue({ recibiConforme: f.nombre });
        this.showRecibiConformeDropdown = false;
    }

    hideRecibiConformeDropdown(): void { setTimeout(() => this.showRecibiConformeDropdown = false, 150); }

    getNroCmrLabel(): string {
        const t = this.recepcionForm.get('tipoDe')?.value;
        if (t === 'DONACION')      return 'N° Carta de Donación';
        if (t === 'TRANSFERENCIA') return 'N° Doc. Transferencia';
        return 'N° CMR / Documento';
    }

    getNroCmrPlaceholder(): string {
        const t = this.recepcionForm.get('tipoDe')?.value;
        if (t === 'DONACION')      return 'CART-DON-001';
        if (t === 'TRANSFERENCIA') return 'TRANS-2026-001';
        return 'CMR-001 / NRT-2026';
    }

    getProveedorLabel(): string {
        const t = this.recepcionForm.get('tipoDe')?.value;
        if (t === 'DONACION')      return 'Donante / Organización';
        if (t === 'TRANSFERENCIA') return 'Dependencia / Origen';
        return 'Proveedor / Empresa';
    }

    getProveedorPlaceholder(): string {
        const t = this.recepcionForm.get('tipoDe')?.value;
        if (t === 'DONACION')      return 'Nombre del donante u organización...';
        if (t === 'TRANSFERENCIA') return 'Dependencia de origen...';
        return 'Nombre del proveedor o empresa...';
    }

    getEntregadoPorLabel(): string {
        const t = this.recepcionForm.get('tipoDe')?.value;
        if (t === 'DONACION')      return 'Representante Donante';
        if (t === 'TRANSFERENCIA') return 'Responsable Origen';
        return 'Entregado / Conforme por';
    }

    hasRecepcionError(field: string, error: string): boolean {
        const c = this.recepcionForm.get(field);
        return !!(c?.hasError(error) && c?.touched);
    }

    cerrarModalRecepcion(): void { this.dialogRef?.close(); }
}
