import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';

interface ReportType {
    id: string;
    name: string;
    description: string;
    icon: string;
}

@Component({
    selector: 'app-reports',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDatepickerModule,
        MatInputModule,
    ],
    templateUrl: './reports.component.html',
    styleUrl: './reports.component.scss'
})
export default class ReportsComponent implements OnInit {
    private _fb = inject(FormBuilder);

    filterForm!: FormGroup;
    loading = false;

    reportTypes: ReportType[] = [
        {
            id: 'inventory',
            name: 'Inventario General',
            description: 'Reporte completo del inventario de herramientas',
            icon: 'heroicons_outline:cube',
        },
        {
            id: 'movements',
            name: 'Movimientos',
            description: 'Historial de movimientos de herramientas',
            icon: 'heroicons_outline:arrow-path',
        },
        {
            id: 'calibrations',
            name: 'Calibraciones',
            description: 'Reporte de calibraciones programadas y completadas',
            icon: 'heroicons_outline:wrench-screwdriver',
        },
        {
            id: 'maintenance',
            name: 'Mantenimientos',
            description: 'Reporte de mantenimientos realizados',
            icon: 'heroicons_outline:wrench',
        },
        {
            id: 'quarantine',
            name: 'Cuarentenas',
            description: 'Herramientas en cuarentena y razones',
            icon: 'heroicons_outline:exclamation-triangle',
        },
        {
            id: 'decommissioned',
            name: 'Bajas',
            description: 'Herramientas dadas de baja',
            icon: 'heroicons_outline:archive-box-x-mark',
        },
    ];

    ngOnInit(): void {
        this.initForm();
    }

    initForm(): void {
        this.filterForm = this._fb.group({
            reportType: [''],
            startDate: [null],
            endDate: [null],
            format: ['pdf'],
        });
    }

    generateReport(): void {
        if (this.filterForm.invalid) {
            this.filterForm.markAllAsTouched();
            return;
        }

        this.loading = true;
        const formData = this.filterForm.value;

        // TODO: Implement report generation
        console.log('Generating report:', formData);

        setTimeout(() => {
            this.loading = false;
            // Simulate download
            alert(`Generando reporte: ${formData.reportType} en formato ${formData.format}`);
        }, 1500);
    }

    quickReport(reportType: string): void {
        this.filterForm.patchValue({ reportType });
        this.generateReport();
    }
}
