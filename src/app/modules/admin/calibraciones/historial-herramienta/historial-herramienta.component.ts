import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CalibrationService } from '../../../../core/services/calibration.service';

interface HistorialRecord {
    id: string | number;
    fecha: string;
    certificado: string;
    resultado: string;
    laboratorio: string;
    tipo: 'transcripcion' | 'calibracion';
    proxima: string;
}

@Component({
    selector: 'app-historial-herramienta',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
    templateUrl: './historial-herramienta.component.html'
})
export class HistorialHerramientaComponent implements OnInit, OnDestroy {
    private route               = inject(ActivatedRoute);
    private calibrationService  = inject(CalibrationService);
    private _destroy$           = new Subject<void>();

    toolId   = '';
    toolCode = '';
    toolName = '';
    records: HistorialRecord[] = [];
    isLoading = false;

    ngOnInit(): void {
        this.toolId   = this.route.snapshot.paramMap.get('toolId') ?? '';
        this.toolCode = this.route.snapshot.queryParamMap.get('code') ?? '—';
        this.toolName = this.route.snapshot.queryParamMap.get('name') ?? '—';
        this.loadHistorial();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    loadHistorial(): void {
        if (!this.toolId) return;
        this.isLoading = true;
        this.calibrationService.getToolCalibrationHistory(this.toolId).pipe(
            takeUntil(this._destroy$),
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: (records: any[]) => {
                this.records = records.map(r => ({
                    id: r.id_calibration ?? r.id ?? 0,
                    fecha: r.calibration_date ?? r.return_date ?? r.date ?? '—',
                    certificado: r.certificate_number ?? r.record_number ?? '—',
                    resultado: r.result ?? r.status ?? '—',
                    laboratorio: r.supplier_name ?? r.laboratory_name ?? '—',
                    tipo: (r.internal_notes ?? '').includes('[TRANSCRIPCIÓN HISTÓRICA]') ? 'transcripcion' : 'calibracion',
                    proxima: r.next_calibration_date ?? '—'
                }));
            }
        });
    }

    reload(): void {
        this.records = [];
        this.loadHistorial();
    }

    cerrar(): void {
        window.close();
    }

    getResultClass(estado: string): string {
        switch (estado.toLowerCase()) {
            case 'approved':
            case 'aprobado':     return 'bg-green-100 text-green-800 border-green-400';
            case 'conditional':
            case 'condicional':  return 'bg-yellow-100 text-yellow-800 border-yellow-400';
            case 'rejected':
            case 'rechazado':    return 'bg-red-100 text-red-800 border-red-400';
            default:             return 'bg-gray-100 text-gray-800 border-gray-400';
        }
    }

    getResultLabel(estado: string): string {
        switch (estado.toLowerCase()) {
            case 'approved':    return 'APROBADO';
            case 'conditional': return 'CONDICIONAL';
            case 'rejected':    return 'RECHAZADO';
            case 'sent':        return 'ENVIADO';
            case 'returned':    return 'RETORNADO';
            case 'in_process':  return 'EN PROCESO';
            default:            return estado.toUpperCase();
        }
    }
}
