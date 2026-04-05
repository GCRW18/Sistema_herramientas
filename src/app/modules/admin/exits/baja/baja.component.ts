import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { DomSanitizer } from '@angular/platform-browser';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Subject, takeUntil, finalize, forkJoin } from 'rxjs';
import { QuarantineService } from '../../../../core/services/quarantine.service';
import { MovementService } from '../../../../core/services/movement.service';

// Interfaces
interface BajaItem {
    toolId?: number;
    codigo: string;
    pn: string;
    sn: string;
    nombre: string;
    cantidad: number;
    contenido: string;
    base: string;
    marca: string;
    id?: string;
    selected?: boolean;
    expanded?: boolean;
}

interface Usuario {
    value: string;
    nombre: string;
    cargo: string;
}

interface Estado {
    value: string;
    label: string;
    color: string;
    icon: string;
}

@Component({
    selector: 'app-baja',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatSelectModule,
        MatDialogModule,
        DragDropModule,
        MatTooltipModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatCheckboxModule
    ],
    templateUrl: './baja.component.html',
    styles: [`
        :host {
            display: block;
            height: 100%;
            --neo-border: 2px solid black;
            --neo-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
        }

        .neo-card-base {
            border: var(--neo-border) !important;
            box-shadow: var(--neo-shadow) !important;
            border-radius: 8px !important;
            background-color: white;
        }

        :host-context(.dark) .neo-card-base {
            background-color: #1e293b !important;
        }

        .spinner-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        :host-context(.dark) .spinner-overlay {
            background: rgba(0,0,0,0.7);
        }

        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #000;
            border-radius: 3px;
        }

        :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .animate-fadeIn {
            animation: fadeIn 0.2s ease-out forwards;
        }

        /* Estilos para inputs readonly */
        input:read-only {
            background-color: #f3f4f6;
            border-color: #9ca3af;
            cursor: not-allowed;
        }

        :host-context(.dark) input:read-only {
            background-color: #1f2937;
            border-color: #4b5563;
            color: #9ca3af;
        }

        /* Estilos para select en dark mode */
        :host-context(.dark) select option {
            background-color: #0F172A;
            color: white;
        }

        /* Estilos para tablas */
        table {
            border-collapse: collapse;
            width: 100%;
        }

        th {
            position: sticky;
            top: 0;
            background-color: #f3f4f6;
            z-index: 10;
        }

        :host-context(.dark) th {
            background-color: #0f172a;
        }
    `]
})
export class BajaComponent implements OnInit {
    public dialogRef = inject(MatDialogRef<BajaComponent>, { optional: true });
    private dialog = inject(MatDialog);
    private iconRegistry = inject(MatIconRegistry);
    private sanitizer = inject(DomSanitizer);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);
    private quarantineService = inject(QuarantineService);

    private _unsubscribeAll = new Subject<void>();
    private movementService = inject(MovementService);

    // Formulario
    bajaForm!: FormGroup;

    // Signals
    dataSource = signal<BajaItem[]>([]);
    nroNota = signal('---');

    // Estados
    isLoading = false;
    isSaving = false;

    // Personal desde API
    usuarios: Usuario[] = [];

    unidades: string[] = ['CBB', 'LPB', 'SRE', 'TJA', 'SRZ', 'CIJ', 'TDD', 'GYA', 'RIB', 'BYC'];

    estados: Estado[] = [
        { value: 'requested', label: 'SOLICITADO',  color: 'yellow', icon: 'pending' },
        { value: 'approved',  label: 'APROBADO',    color: 'green',  icon: 'check_circle' },
        { value: 'rejected',  label: 'RECHAZADO',   color: 'red',    icon: 'cancel' },
        { value: 'executed',  label: 'EJECUTADO',   color: 'blue',   icon: 'engineering' },
        { value: 'cancelled', label: 'CANCELADO',   color: 'gray',   icon: 'block' }
    ];

    constructor() {
        this.registerIcons();
    }

    ngOnInit(): void {
        this.initForm();
        this.cargarPersonal();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private registerIcons(): void {
        this.iconRegistry.addSvgIcon('heroicons_outline:clipboard-document-list',
            this.sanitizer.bypassSecurityTrustHtml(`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>`));
    }

    private initForm(): void {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentTime = this.formatTime(now);

        this.bajaForm = this.fb.group({
            procesadoPor: ['SISTEMASBOA', Validators.required],
            nombre: ['DEPARTAMENTO SISTEMAS BOLIVIA'],
            cargo: ['DPTO. SISTEMAS'],
            fecha: [today, Validators.required],
            hora: [currentTime, Validators.required],
            verificadoPor: [''],
            estado: ['requested', Validators.required],
            motivo: ['other', Validators.required],
            disposalMethod: ['other'],
            inspector: [''],
            unidad: [null],
            autorizadoPor: [''],
            observaciones: ['']
        });

        // Suscripción para actualizar nombre y cargo
        this.bajaForm.get('procesadoPor')?.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(value => {
                const usuario = this.usuarios.find(u => u.value === value);
                if (usuario) {
                    this.bajaForm.patchValue({
                        nombre: usuario.nombre,
                        cargo: usuario.cargo
                    }, { emitEvent: false });
                } else {
                    this.bajaForm.patchValue({
                        nombre: '',
                        cargo: ''
                    }, { emitEvent: false });
                }
            });

        // Validación de fecha futura
        this.bajaForm.get('fecha')?.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(value => {
                if (value) {
                    const selectedDate = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (selectedDate > today) {
                        this.bajaForm.get('fecha')?.setErrors({ futureDate: true });
                        this.showMessage('La fecha no puede ser futura', 'warning');
                    }
                }
            });
    }

    private formatTime(date: Date): string {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    private cargarPersonal(): void {
        this.movementService.getPersonal().pipe(takeUntil(this._unsubscribeAll)).subscribe({
            next: (personal) => {
                this.usuarios = personal.map((p: any) => ({
                    value:  String(p.id_employee ?? p.id ?? ''),
                    nombre: [p.nombre ?? '', p.apellido_paterno ?? '', p.apellido_materno ?? ''].filter(Boolean).join(' '),
                    cargo:  p.cargo ?? ''
                }));
            }
        });
    }

    async openHerramientaABaja(): Promise<void> {
        try {
            const { HerramientaABajaComponent } = await import('./herramienta-a-baja/herramienta-a-baja.component');

            const dialogRef = this.dialog.open(HerramientaABajaComponent, {
                width: '1100px',
                maxWidth: '95vw',
                height: 'auto',
                maxHeight: '90vh',
                panelClass: ['neo-dialog', 'border-2', 'border-black'],
                hasBackdrop: true,
                disableClose: false,
                autoFocus: false
            });

            dialogRef.afterClosed()
                .pipe(takeUntil(this._unsubscribeAll))
                .subscribe(result => {
                    if (result?.action === 'agregar' && result.data) {
                        this.agregarHerramienta(result.data);
                    }
                });
        } catch (error) {
            console.error('Error al abrir el modal:', error);
            this.showMessage('Error al cargar el diálogo', 'error');
        }
    }

    private agregarHerramienta(data: any): void {
        const newItem: BajaItem = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            toolId:  data.id_tool ?? 0,
            codigo: data.codigo || '',
            pn: data.pn || '',
            sn: data.sn || '',
            nombre: data.nombre || '',
            cantidad: data.cantidad || 1,
            contenido: data.contenido || '',
            base: data.base || '',
            marca: data.marca || '',
            selected: false,
            expanded: false
        };

        this.dataSource.update(items => [...items, newItem]);
        this.showMessage(`Herramienta ${newItem.codigo} agregada a la lista`, 'success');
    }

    removeLastItem(): void {
        if (this.dataSource().length > 0) {
            const removed = this.dataSource()[this.dataSource().length - 1];
            this.dataSource.update(items => {
                const newItems = [...items];
                newItems.pop();
                return newItems;
            });
            this.showMessage(`Última herramienta (${removed.codigo}) removida`, 'info');
        }
    }

    removeItem(index: number): void {
        if (index >= 0 && index < this.dataSource().length) {
            const removed = this.dataSource()[index];
            this.dataSource.update(items => {
                const newItems = [...items];
                newItems.splice(index, 1);
                return newItems;
            });
            this.showMessage(`Herramienta ${removed.codigo} removida`, 'info');
        }
    }

    clearAllItems(): void {
        if (this.dataSource().length > 0 && confirm('¿Eliminar todas las herramientas de la lista?')) {
            this.dataSource.set([]);
            this.showMessage('Lista de herramientas vaciada', 'info');
        }
    }

    getTotalCantidad(): number {
        return this.dataSource().reduce((total, item) => total + (Number(item.cantidad) || 1), 0);
    }

    getEstadoLabel(estadoValue: string): string {
        const estado = this.estados.find(e => e.value === estadoValue);
        return estado ? estado.label : 'No definido';
    }

    getEstadoIcon(estadoValue: string): string {
        const estado = this.estados.find(e => e.value === estadoValue);
        return estado ? estado.icon : 'help_outline';
    }

    getEstadoColor(estadoValue: string): string {
        const estado = this.estados.find(e => e.value === estadoValue);
        return estado ? estado.color : 'gray';
    }

    formatDateTime(): string {
        const fecha = this.bajaForm.get('fecha')?.value;
        const hora = this.bajaForm.get('hora')?.value;

        if (fecha && hora) {
            try {
                const [year, month, day] = fecha.split('-');
                const date = new Date(year, month - 1, day);
                const formattedDate = date.toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
                return `${formattedDate} ${hora}`;
            } catch {
                return `${fecha} ${hora}`;
            }
        }
        return 'No definido';
    }

    isProcessValid(): boolean {
        // Validar formulario
        if (this.bajaForm.invalid) return false;

        // Validar que haya al menos una herramienta
        if (this.dataSource().length === 0) return false;

        // Validar campos requeridos específicos
        const procesadoPor = this.bajaForm.get('procesadoPor')?.value;
        const fecha = this.bajaForm.get('fecha')?.value;
        const hora = this.bajaForm.get('hora')?.value;
        const estado = this.bajaForm.get('estado')?.value;

        return !!(procesadoPor && fecha && hora && estado);
    }

    procesarEImprimir(): void {
        if (!this.isProcessValid()) {
            if (this.dataSource().length === 0) {
                this.showMessage('Agregue al menos una herramienta para procesar', 'error');
                return;
            }

            this.bajaForm.markAllAsTouched();

            // Mostrar campos faltantes
            if (this.bajaForm.get('procesadoPor')?.invalid) {
                this.showMessage('Complete el campo "Procesado Por"', 'error');
            } else if (this.bajaForm.get('fecha')?.invalid) {
                this.showMessage('Complete la fecha', 'error');
            } else if (this.bajaForm.get('hora')?.invalid) {
                this.showMessage('Complete la hora', 'error');
            } else if (this.bajaForm.get('estado')?.invalid) {
                this.showMessage('Complete el estado', 'error');
            }

            return;
        }

        this.isLoading = true;

        const fv      = this.bajaForm.getRawValue();
        const items   = this.dataSource();
        const usuario = this.usuarios.find(u => u.value === fv.procesadoPor);

        const calls = items.map(item => {
            const payload: any = {
                status:             fv.estado          ?? 'requested',
                reason:             fv.motivo          ?? 'other',
                reason_description: fv.observaciones   || '',
                disposal_method:    fv.disposalMethod  ?? 'other',
                request_date:       fv.fecha,
                requested_by_name:  usuario?.nombre    ?? fv.procesadoPor ?? '',
                authorized_by_name: fv.autorizadoPor   ?? '',
                notes:              fv.observaciones   ?? ''
            };
            if (item.toolId && item.toolId > 0) payload['tool_id'] = item.toolId;
            return this.quarantineService.createDecommission(payload);
        });

        forkJoin(calls).pipe(
            finalize(() => { this.isLoading = false; }),
            takeUntil(this._unsubscribeAll)
        ).subscribe({
            next: (results: any[]) => {
                const nro = results[0]?.decommission_number || results[0]?.record_number || 'BJA';
                this.nroNota.set(nro);
                this.generarReporteBaja({ nroNota: nro, ...fv, herramientas: items });
                this.showMessage(`Baja ${this.nroNota()} procesada exitosamente`, 'success');

                // Navegar después de éxito
                setTimeout(() => {
                    if (this.dialogRef) {
                        this.dialogRef.close({ success: true });
                    } else {
                        this.router.navigate(['/salidas']);
                    }
                }, 1500);
            },
            error: (err: any) => {
                this.showMessage(err?.message || 'Error al registrar la baja', 'error');
            }
        });
    }

    private generarReporteBaja(processData: any): void {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            this.showMessage('Permita ventanas emergentes para imprimir', 'warning');
            return;
        }

        const fechaActual = new Date().toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Baja de Herramientas - ${processData.nroNota}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 30px;
            font-size: 12px;
            color: #000;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #000;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .logo {
            font-size: 24px;
            font-weight: 900;
            text-transform: uppercase;
        }
        .nota {
            background: #000;
            color: #fff;
            padding: 8px 20px;
            font-weight: 900;
            border: 2px solid #000;
            letter-spacing: 1px;
        }
        h1 {
            text-align: center;
            background: #ef4444;
            color: white;
            padding: 12px;
            border: 2px solid #000;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .info-box {
            border: 2px solid #000;
            padding: 15px;
            box-shadow: 4px 4px 0px 0px #000;
        }
        .info-box h3 {
            margin: -15px -15px 15px -15px;
            padding: 8px 15px;
            background: #0F172A;
            color: white;
            font-size: 14px;
            font-weight: 900;
            text-transform: uppercase;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            border: 2px solid #000;
        }
        th {
            background: #0F172A;
            color: white;
            padding: 10px;
            text-align: left;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            border: 1px solid #000;
        }
        td {
            padding: 8px 10px;
            border: 1px solid #000;
        }
        .footer {
            margin-top: 50px;
            display: flex;
            justify-content: space-around;
        }
        .signature {
            text-align: center;
            width: 200px;
        }
        .signature-line {
            border-top: 2px solid #000;
            margin-top: 50px;
            padding-top: 10px;
            font-weight: 900;
        }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            background: #ef4444;
            color: white;
            font-weight: 900;
            border: 1px solid #000;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">BOA - SISTEMA DE HERRAMIENTAS</div>
        <div class="nota">${processData.nroNota}</div>
    </div>

    <h1>ACTA DE BAJA DE HERRAMIENTAS</h1>

    <div class="info-grid">
        <div class="info-box">
            <h3>PROCESADO POR</h3>
            <p><strong>Usuario:</strong> ${processData.procesadoPor || '-'}</p>
            <p><strong>Nombre:</strong> ${processData.nombre || '-'}</p>
            <p><strong>Cargo:</strong> ${processData.cargo || '-'}</p>
        </div>
        <div class="info-box">
            <h3>VERIFICACIÓN</h3>
            <p><strong>Verificador:</strong> ${processData.verificadoPor || '-'}</p>
            <p><strong>Inspector:</strong> ${processData.inspector || '-'}</p>
            <p><strong>Autorizado por:</strong> ${processData.autorizadoPor || '-'}</p>
        </div>
        <div class="info-box">
            <h3>DATOS DEL PROCESO</h3>
            <p><strong>Fecha:</strong> ${processData.fecha || '-'}</p>
            <p><strong>Hora:</strong> ${processData.hora || '-'}</p>
            <p><strong>Estado:</strong> <span class="badge">${this.getEstadoLabel(processData.estado)}</span></p>
            <p><strong>Unidad:</strong> ${processData.unidad || 'No especificada'}</p>
        </div>
    </div>

    <h2 style="font-size: 16px; margin: 20px 0 10px 0;">LISTA DE HERRAMIENTAS DADAS DE BAJA</h2>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>CÓDIGO</th>
                <th>P/N</th>
                <th>S/N</th>
                <th>DESCRIPCIÓN</th>
                <th>CANT.</th>
                <th>BASE</th>
                <th>MARCA</th>
            </tr>
        </thead>
        <tbody>
            ${processData.herramientas.map((item: any, index: number) => `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${item.codigo || '-'}</strong></td>
                <td>${item.pn || '-'}</td>
                <td>${item.sn || '-'}</td>
                <td>${item.nombre || item.descripcion || '-'}</td>
                <td style="text-align: center;"><strong>${item.cantidad || 1}</strong></td>
                <td>${item.base || '-'}</td>
                <td>${item.marca || '-'}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>

    <div style="display: flex; justify-content: space-between; margin: 20px 0; padding: 15px; border: 2px solid #000; background: #f3f4f6;">
        <div><strong>TOTAL HERRAMIENTAS:</strong> ${processData.totalHerramientas}</div>
        <div><strong>TOTAL ÍTEMS:</strong> ${processData.totalItems}</div>
        <div><strong>FECHA PROCESAMIENTO:</strong> ${fechaActual}</div>
    </div>

    ${processData.observaciones ? `
    <div style="margin: 20px 0; padding: 15px; border: 2px solid #000;">
        <strong>OBSERVACIONES:</strong><br>
        ${processData.observaciones}
    </div>
    ` : ''}

    <div class="footer">
        <div class="signature">
            <div class="signature-line">PROCESADO POR</div>
            <p style="margin-top: 5px;">${processData.nombre || ''}</p>
            <p style="font-size: 11px;">${processData.cargo || ''}</p>
        </div>
        <div class="signature">
            <div class="signature-line">VERIFICADO POR</div>
            <p style="margin-top: 5px;">${processData.verificadoPor || '____________________'}</p>
        </div>
        <div class="signature">
            <div class="signature-line">AUTORIZADO POR</div>
            <p style="margin-top: 5px;">${processData.autorizadoPor || '____________________'}</p>
        </div>
    </div>

    <div style="text-align: center; margin-top: 40px; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 15px;">
        Documento generado desde el Sistema de Gestión de Herramientas - BOA<br>
        Fecha de impresión: ${new Date().toLocaleString('es-BO')}
    </div>
</body>
</html>`;

        const printHtml = htmlContent.replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script></body>');
        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.focus();
    }

    // Helpers para validación
    hasError(field: string, error: string): boolean {
        const control = this.bajaForm.get(field);
        return control ? control.hasError(error) && control.touched : false;
    }

    // Navegación
    goBack(): void {
        if (this.dataSource().length > 0 || this.bajaForm.dirty) {
            if (confirm('Hay cambios sin guardar. ¿Desea salir?')) {
                this.cerrarVentana();
            }
        } else {
            this.cerrarVentana();
        }
    }

    private cerrarVentana(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/salidas']);
        }
    }

    // Snackbar
    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'OK', {
            duration: 3000,
            panelClass: [`snackbar-${type}`],
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
        });
    }
}
