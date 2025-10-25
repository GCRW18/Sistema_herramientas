import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToolService, NotificationService, BarcodeService } from 'app/core/services';
import { Tool, BarcodeFormat } from 'app/core/models';

@Component({
    selector: 'app-barcode-generator',
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
        MatTableModule,
        MatTooltipModule,
    ],
    templateUrl: './barcode-generator.component.html',
    styleUrl: './barcode-generator.component.scss'
})
export default class BarcodeGeneratorComponent implements OnInit {
    private _fb = inject(FormBuilder);
    private _toolService = inject(ToolService);
    private _notificationService = inject(NotificationService);
    private _barcodeService = inject(BarcodeService);

    searchForm!: FormGroup;
    tools: Tool[] = [];
    selectedTools: Tool[] = [];
    loading = false;
    displayedColumns = ['select', 'code', 'name', 'category', 'location'];

    // Barcode generation options
    barcodeFormat = 'CODE128'; // Default format
    barcodeFormats = [
        { value: 'CODE128', label: 'CODE128' },
        { value: 'CODE39', label: 'CODE39' },
        { value: 'EAN13', label: 'EAN13' },
        { value: 'QR', label: 'QR Code' },
    ];

    includeDetails = true; // Include tool name and details
    paperSize = 'A4';
    paperSizes = [
        { value: 'A4', label: 'A4' },
        { value: 'Letter', label: 'Carta' },
        { value: 'Label', label: 'Etiqueta' },
    ];

    ngOnInit(): void {
        this.initForm();
    }

    initForm(): void {
        this.searchForm = this._fb.group({
            search: [''],
            category: [''],
            warehouse: [''],
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
                    if (filters.warehouse) {
                        match = match && tool.warehouse === filters.warehouse;
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

    generateBarcodes(): void {
        if (this.selectedTools.length === 0) {
            this._notificationService.warning('Seleccione al menos una herramienta');
            return;
        }

        this._notificationService.info(
            `Generando ${this.selectedTools.length} código(s) de barras en formato ${this.barcodeFormat}...`
        );

        const toolIds = this.selectedTools.map(t => t.id);

        this._barcodeService.generateBarcodes({
            toolIds,
            format: this.barcodeFormat as BarcodeFormat,
            includeDetails: this.includeDetails,
            paperSize: this.paperSize as any,
        }).subscribe({
            next: (response) => {
                if (response.success) {
                    this._notificationService.success('Códigos de barras generados correctamente');
                    if (response.fileUrl) {
                        window.open(response.fileUrl, '_blank');
                    }
                } else {
                    this._notificationService.error(response.error || 'Error al generar códigos de barras');
                }
            },
            error: (error) => {
                this._notificationService.error('Error al generar códigos de barras');
                console.error(error);
            },
        });
    }

    printBarcodes(): void {
        if (this.selectedTools.length === 0) {
            this._notificationService.warning('Seleccione al menos una herramienta');
            return;
        }

        this._notificationService.info('Preparando impresión...');

        const toolIds = this.selectedTools.map(t => t.id);

        this._barcodeService.printBarcodes({
            toolIds,
            format: this.barcodeFormat as BarcodeFormat,
            includeDetails: this.includeDetails,
            paperSize: this.paperSize as any,
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
                this._notificationService.error('Error al imprimir códigos de barras');
                console.error(error);
            },
        });
    }

    downloadBarcodes(): void {
        if (this.selectedTools.length === 0) {
            this._notificationService.warning('Seleccione al menos una herramienta');
            return;
        }

        this._notificationService.info('Preparando descarga...');

        const toolIds = this.selectedTools.map(t => t.id);

        this._barcodeService.downloadBarcodes({
            toolIds,
            format: this.barcodeFormat as BarcodeFormat,
            includeDetails: this.includeDetails,
            paperSize: this.paperSize as any,
        }).subscribe({
            next: (response) => {
                if (response.success && response.fileUrl) {
                    // Open the file URL in a new window to trigger download
                    window.open(response.fileUrl, '_blank');
                    this._notificationService.success('Códigos de barras descargados correctamente');
                } else {
                    this._notificationService.error(response.error || 'Error al descargar códigos de barras');
                }
            },
            error: (error) => {
                this._notificationService.error('Error al descargar códigos de barras');
                console.error(error);
            },
        });
    }
}
