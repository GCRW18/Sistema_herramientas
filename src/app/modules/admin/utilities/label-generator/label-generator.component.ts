import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToolService, NotificationService, LabelService } from 'app/core/services';
import { Tool, LabelTemplate, LabelSize } from 'app/core/models';

@Component({
    selector: 'app-label-generator',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatRadioModule,
        MatTableModule,
        MatTooltipModule,
    ],
    templateUrl: './label-generator.component.html',
    styleUrl: './label-generator.component.scss'
})
export default class LabelGeneratorComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _toolService = inject(ToolService);
    private _notificationService = inject(NotificationService);
    private _labelService = inject(LabelService);

    searchForm!: FormGroup;
    tools: Tool[] = [];
    selectedTools: Tool[] = [];
    loading = false;
    displayedColumns = ['select', 'code', 'name', 'category', 'status'];

    // Label templates
    labelTemplate = 'standard';
    labelTemplates = [
        { value: 'standard', label: 'Estándar', description: 'Código + Nombre + Categoría' },
        { value: 'detailed', label: 'Detallada', description: 'Incluye ubicación y estado' },
        { value: 'compact', label: 'Compacta', description: 'Solo código y nombre' },
        { value: 'qr', label: 'QR Code', description: 'Con código QR grande' },
    ];

    // Label options
    labelSize = 'medium';
    labelSizes = [
        { value: 'small', label: 'Pequeña (40x20mm)' },
        { value: 'medium', label: 'Mediana (60x30mm)' },
        { value: 'large', label: 'Grande (80x40mm)' },
    ];

    includeBarcode = true;
    includeQR = false;
    includeCompanyLogo = true;

    ngOnInit(): void {
        this.initForm();
    }

    initForm(): void {
        this.searchForm = this._fb.group({
            search: [''],
            category: [''],
            status: [''],
        });
    }

    searchTools(): void {
        const filters = this.searchForm.value;
        this.loading = true;

        this._toolService.getTools().subscribe({
            next: (tools) => {
                // Apply filters
                this.tools = tools.filter(tool => {
                    let match = true;
                    if (filters.search) {
                        const search = filters.search.toLowerCase();
                        match = match && (
                            tool.code.toLowerCase().includes(search) ||
                            tool.name.toLowerCase().includes(search)
                        );
                    }
                    if (filters.category) {
                        match = match && tool.category === filters.category;
                    }
                    if (filters.status) {
                        match = match && tool.status === filters.status;
                    }
                    return match;
                });
                this.loading = false;
            },
            error: () => {
                this._notificationService.error('Error al buscar herramientas');
                this.loading = false;
            },
        });
    }

    toggleToolSelection(tool: Tool): void {
        const index = this.selectedTools.findIndex(t => t.id === tool.id);
        if (index > -1) {
            this.selectedTools.splice(index, 1);
        } else {
            this.selectedTools.push(tool);
        }
    }

    isToolSelected(tool: Tool): boolean {
        return this.selectedTools.some(t => t.id === tool.id);
    }

    selectAll(): void {
        this.selectedTools = [...this.tools];
    }

    clearSelection(): void {
        this.selectedTools = [];
    }

    getSelectedTemplate(): any {
        return this.labelTemplates.find(t => t.value === this.labelTemplate);
    }

    generateLabels(): void {
        if (this.selectedTools.length === 0) {
            this._notificationService.warning('Seleccione al menos una herramienta');
            return;
        }

        const template = this.getSelectedTemplate();
        this._notificationService.info(
            `Generando ${this.selectedTools.length} etiqueta(s) con plantilla "${template?.label}"...`
        );

        const toolIds = this.selectedTools.map(t => t.id);

        this._labelService.generateLabels({
            toolIds,
            options: {
                template: this.labelTemplate as LabelTemplate,
                size: this.labelSize as LabelSize,
                includeBarcode: this.includeBarcode,
                includeQR: this.includeQR,
                includeCompanyLogo: this.includeCompanyLogo,
            },
        }).subscribe({
            next: (response) => {
                if (response.success) {
                    this._notificationService.success('Etiquetas generadas correctamente');
                    if (response.fileUrl) {
                        window.open(response.fileUrl, '_blank');
                    }
                } else {
                    this._notificationService.error(response.error || 'Error al generar etiquetas');
                }
            },
            error: (error) => {
                this._notificationService.error('Error al generar etiquetas');
                console.error(error);
            },
        });
    }

    printLabels(): void {
        if (this.selectedTools.length === 0) {
            this._notificationService.warning('Seleccione al menos una herramienta');
            return;
        }

        this._notificationService.info('Preparando impresión...');

        const toolIds = this.selectedTools.map(t => t.id);

        this._labelService.printLabels({
            toolIds,
            options: {
                template: this.labelTemplate as LabelTemplate,
                size: this.labelSize as LabelSize,
                includeBarcode: this.includeBarcode,
                includeQR: this.includeQR,
                includeCompanyLogo: this.includeCompanyLogo,
            },
        }).subscribe({
            next: (response) => {
                if (response.success) {
                    this._notificationService.success('Documento enviado a impresión');
                    if (response.fileUrl) {
                        window.print();
                    }
                } else {
                    this._notificationService.error(response.error || 'Error al imprimir');
                }
            },
            error: (error) => {
                this._notificationService.error('Error al imprimir etiquetas');
                console.error(error);
            },
        });
    }

    downloadLabels(): void {
        if (this.selectedTools.length === 0) {
            this._notificationService.warning('Seleccione al menos una herramienta');
            return;
        }

        this._notificationService.info('Preparando descarga...');

        const toolIds = this.selectedTools.map(t => t.id);

        this._labelService.downloadLabels({
            toolIds,
            options: {
                template: this.labelTemplate as LabelTemplate,
                size: this.labelSize as LabelSize,
                includeBarcode: this.includeBarcode,
                includeQR: this.includeQR,
                includeCompanyLogo: this.includeCompanyLogo,
            },
        }).subscribe({
            next: (response) => {
                if (response.success && response.fileUrl) {
                    // Open the file URL in a new window to trigger download
                    window.open(response.fileUrl, '_blank');
                    this._notificationService.success('Etiquetas descargadas correctamente');
                } else {
                    this._notificationService.error(response.error || 'Error al descargar etiquetas');
                }
            },
            error: (error) => {
                this._notificationService.error('Error al descargar etiquetas');
                console.error(error);
            },
        });
    }

    getStatusLabel(status: string): string {
        const statusMap: Record<string, string> = {
            available: 'Disponible',
            in_use: 'En Uso',
            maintenance: 'Mantenimiento',
            calibration: 'Calibración',
            quarantine: 'Cuarentena',
            decommissioned: 'Baja',
        };
        return statusMap[status] || status;
    }
}
