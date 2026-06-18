import {
    Component, OnInit, inject, signal, computed,
    ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs/operators';
import {
    ReportesService, FiltrosReporte,
    ToolReporteRow, LoanReporteRow, MiscStockRow, MiscMovRow, KitReporteRow
} from './reportes.service';

/* ── Tipos de columna ──────────────────────────────────────────────────── */
export interface ColDef {
    key:    string;
    header: string;
    width?: string;
    tipo?:  'text' | 'number' | 'date' | 'badge' | 'days' | 'bool';
    badge?: Record<string, string>;
    align?: 'left' | 'center' | 'right';
}

/* ── Config de cada reporte ────────────────────────────────────────────── */
interface ReporteConfig {
    mghCode:     string;
    columnas:    ColDef[];
    filtros?:    FilterField[];
    loader:      (svc: ReportesService, f: FiltrosReporte) => any;
    excelCols?:  { key: string; header: string }[];
}

interface FilterField {
    key:          string;
    label:        string;
    type:         'date' | 'select' | 'number';
    options?:     { value: any; label: string }[];
    default?:     any;
}

/* ── Mapa de traducción de estados al español ─────────────────────────── */
export const STATUS_LABELS: Record<string, string> = {
    // Herramientas / Inventario
    AVAILABLE:        'Disponible',
    IN_USE:           'En uso',
    MAINTENANCE:      'Mantenimiento',
    QUARANTINE:       'Cuarentena',
    DECOMMISSIONED:   'Baja',
    // Condición
    NEW:              'Nuevo',
    USED:             'Usado',
    RECONDITIONED:    'Reacondicionado',
    // Préstamos
    ACTIVE:           'Activo',
    RETURNED:         'Devuelto',
    OVERDUE:          'En mora',
    // Kits
    complete:         'Completo',
    incomplete:       'Incompleto',
    in_use:           'En uso',
    in_calibration:   'En calibración',
    // minúsculas (valores reales del API)
    available:        'Disponible',
    in_maintenance:   'Mantenimiento',
    quarantine:       'Cuarentena',
    decommissioned:   'Baja',
    new:              'Nuevo',
    used:             'Usado',
    reconditioned:    'Reacondicionado',
    good:             'Bueno',
    active:           'Activo',
    returned:         'Devuelto',
    overdue:          'En mora',
};

/* ─────────────────────────────────────────────────────────────────────── */

export const REPORTE_CONFIGS: Record<string, ReporteConfig> = {

    /* ── Inventario ─────────────────────────── */
    'inv-1': {
        mghCode: 'MGH-108',
        columnas: [
            { key: 'code',             header: 'Código',     width: '110px' },
            { key: 'name',             header: 'Nombre',                     },
            { key: 'part_number',      header: 'P/N',        width: '110px' },
            { key: 'serial_number',    header: 'S/N',        width: '110px' },
            { key: 'brand',            header: 'Marca',      width: '100px' },
            { key: 'status',           header: 'Estado',     tipo: 'badge',
                badge: { AVAILABLE:'bg-green-100 text-green-800 border-green-700', IN_USE:'bg-blue-100 text-blue-800 border-blue-700',
                    MAINTENANCE:'bg-yellow-100 text-yellow-800 border-yellow-700', QUARANTINE:'bg-red-100 text-red-800 border-red-700',
                    DECOMMISSIONED:'bg-gray-200 text-gray-700 border-gray-500' } },
            { key: 'quantity_in_stock',header: 'Cant.',      tipo: 'number', width: '70px', align: 'center' },
            { key: 'requires_calibration', header: 'Cal.', tipo: 'bool', width: '60px', align: 'center' },
            { key: 'next_calibration_date', header: 'Vto. Cal.', tipo: 'date', width: '100px' },
        ],
        filtros: [
            { key: 'status', label: 'Estado', type: 'select', options: [
                    { value: '', label: 'Todos' }, { value: 'AVAILABLE', label: 'Disponible' },
                    { value: 'IN_USE', label: 'En uso' }, { value: 'MAINTENANCE', label: 'En mantenimiento' },
                    { value: 'QUARANTINE', label: 'Cuarentena' }, { value: 'DECOMMISSIONED', label: 'Baja' }
                ]},
            { key: 'requires_calibration', label: 'Calibración', type: 'select', options: [
                    { value: '', label: 'Todos' }, { value: 'true', label: 'Requiere cal.' }, { value: 'false', label: 'No requiere' }
                ]}
        ],
        loader: (svc, f) => svc.getReporteHerramientas(f)
    },

    'inv-2': {
        mghCode: 'R-INV-02',
        columnas: [
            { key: 'code',    header: 'Código',   width: '110px' },
            { key: 'name',    header: 'Nombre' },
            { key: 'status',  header: 'Estado',   tipo: 'badge',
                badge: { AVAILABLE:'bg-green-100 text-green-800 border-green-700', IN_USE:'bg-blue-100 text-blue-800 border-blue-700',
                    MAINTENANCE:'bg-yellow-100 text-yellow-800 border-yellow-700', QUARANTINE:'bg-red-100 text-red-800 border-red-700',
                    DECOMMISSIONED:'bg-gray-200 text-gray-700 border-gray-500' } },
            { key: 'condition', header: 'Condición', tipo: 'badge',
                badge: { NEW:'bg-teal-100 text-teal-800 border-teal-600', USED:'bg-orange-100 text-orange-800 border-orange-600',
                    RECONDITIONED:'bg-purple-100 text-purple-800 border-purple-600' } },
            { key: 'brand',   header: 'Marca',    width: '100px' },
            { key: 'part_number', header: 'P/N',  width: '110px' },
        ],
        filtros: [{ key: 'status', label: 'Estado', type: 'select', options: [
                { value: '', label: 'Todos' }, { value: 'AVAILABLE', label: 'Disponible' },
                { value: 'IN_USE', label: 'En uso' }, { value: 'MAINTENANCE', label: 'Mantenimiento' },
                { value: 'QUARANTINE', label: 'Cuarentena' }, { value: 'DECOMMISSIONED', label: 'Baja' }
            ]}],
        loader: (svc, f) => svc.getReporteHerramientas(f)
    },

    'inv-4': {
        mghCode: 'MGH-112',
        columnas: [
            { key: 'code',       header: 'Código',    width: '110px' },
            { key: 'name',       header: 'Nombre' },
            { key: 'part_number',header: 'P/N',       width: '110px' },
            { key: 'serial_number', header: 'S/N',    width: '110px' },
            { key: 'brand',      header: 'Marca',     width: '100px' },
            { key: 'status',     header: 'Estado',    tipo: 'badge',
                badge: { QUARANTINE:'bg-red-100 text-red-800 border-red-700', DECOMMISSIONED:'bg-gray-200 text-gray-700 border-gray-500' } },
            { key: 'notes',      header: 'Observaciones' },
        ],
        loader: (svc, f) => svc.getReporteHerramientas({ ...f, status: 'QUARANTINE' })
    },

    'inv-5': {
        mghCode: 'MGH-105',
        columnas: [
            { key: 'code',           header: 'Código',    width: '110px' },
            { key: 'name',           header: 'Nombre' },
            { key: 'part_number',    header: 'P/N',       width: '110px' },
            { key: 'serial_number',  header: 'S/N',       width: '110px' },
            { key: 'brand',          header: 'Marca',     width: '100px' },
            { key: 'manufacture_origin', header: 'Origen' },
            { key: 'quantity_in_stock',  header: 'Cant.', tipo: 'number', width: '70px', align: 'center' },
        ],
        loader: (svc, f) => svc.getReporteHerramientas({ ...f, manufacture_origin: 'LOCAL' })
    },

    /* ── Calibración ────────────────────────── */
    'cal-1': {
        mghCode: 'MGH-102',
        columnas: [
            { key: 'code',                     header: 'Código',      width: '110px' },
            { key: 'name',                     header: 'Nombre' },
            { key: 'model',                    header: 'Modelo/P/N',  width: '120px' },
            { key: 'serial_number',            header: 'S/N',         width: '110px' },
            { key: 'brand',                    header: 'Marca',       width: '100px' },
            { key: 'last_calibration_date',    header: 'Últ. Cal.',   tipo: 'date', width: '100px' },
            { key: 'next_calibration_date',    header: 'Próx. Cal.',  tipo: 'date', width: '100px' },
            { key: 'days_to_calibration_expiry', header: 'Días rem.', tipo: 'days', width: '90px', align: 'center' },
        ],
        filtros: [
            { key: 'diasHolgura', label: 'Vence en ≤ días', type: 'number', default: '' }
        ],
        loader: (svc, f) => svc.getReporteCalibracion(f)
    },

    'cal-2': {
        mghCode: 'MGH-104',
        columnas: [
            { key: 'code',                       header: 'Código',    width: '110px' },
            { key: 'name',                       header: 'Nombre' },
            { key: 'part_number',                header: 'P/N',       width: '110px' },
            { key: 'serial_number',              header: 'S/N',       width: '110px' },
            { key: 'next_calibration_date',      header: 'Vto. Cal.', tipo: 'date', width: '100px' },
            { key: 'days_to_calibration_expiry', header: 'Días rem.', tipo: 'days', width: '90px', align: 'center' },
        ],
        filtros: [
            { key: 'diasHolgura', label: 'Holgura (días)', type: 'number', default: 60 }
        ],
        loader: (svc, f) => svc.getReporteProximasVencer(f.diasHolgura ?? 60, f)
    },

    'cal-3': {
        mghCode: 'R-CAL-03',
        columnas: [
            { key: 'code',                       header: 'Código',    width: '110px' },
            { key: 'name',                       header: 'Nombre' },
            { key: 'part_number',                header: 'P/N',       width: '110px' },
            { key: 'serial_number',              header: 'S/N',       width: '110px' },
            { key: 'next_calibration_date',      header: 'Vto. Cal.', tipo: 'date', width: '100px' },
            { key: 'days_to_calibration_expiry', header: 'Días vencida', tipo: 'days', width: '110px', align: 'center' },
        ],
        loader: (svc, f) => svc.getReporteVencidas(f)
    },

    'cal-4': {
        mghCode: 'MGH-111',
        columnas: [
            { key: 'code',           header: 'Código',        width: '110px' },
            { key: 'name',           header: 'Nombre' },
            { key: 'part_number',    header: 'P/N',           width: '110px' },
            { key: 'serial_number',  header: 'S/N',           width: '110px' },
            { key: 'last_calibration_date', header: 'F. Envío', tipo: 'date', width: '100px' },
        ],
        loader: (svc, f) => svc.getReporteEnviadasCalibracion(f)
    },

    /* ── Préstamos ──────────────────────────── */
    'pre-1': {
        mghCode: 'R-PRE-01',
        columnas: [
            { key: 'loan_number',       header: 'N° Nota',     width: '110px' },
            { key: 'borrower_name',     header: 'Deudor' },
            { key: 'borrower_license',  header: 'Licencia',    width: '100px' },
            { key: 'aircraft',          header: 'Aeronave',    width: '90px' },
            { key: 'work_order_number', header: 'OT',          width: '110px' },
            { key: 'loan_date',         header: 'F. Préstamo', tipo: 'date', width: '110px' },
            { key: 'expected_return_date', header: 'F. Dev. Est.', tipo: 'date', width: '110px' },
            { key: 'status',            header: 'Estado',      tipo: 'badge',
                badge: { ACTIVE:'bg-blue-100 text-blue-800 border-blue-700', RETURNED:'bg-green-100 text-green-800 border-green-700',
                    OVERDUE:'bg-red-100 text-red-800 border-red-700' } },
        ],
        filtros: [
            { key: 'fechaDesde', label: 'Desde', type: 'date' },
            { key: 'fechaHasta', label: 'Hasta', type: 'date' },
        ],
        loader: (svc, f) => svc.getReportePrestamos({ ...f, status: 'ACTIVE' })
    },

    'pre-2': {
        mghCode: 'MGH-106',
        columnas: [
            { key: 'loan_number',       header: 'N° Nota',     width: '110px' },
            { key: 'borrower_name',     header: 'Deudor' },
            { key: 'borrower_license',  header: 'Licencia',    width: '100px' },
            { key: 'aircraft',          header: 'Aeronave',    width: '90px' },
            { key: 'loan_date',         header: 'F. Préstamo', tipo: 'date', width: '110px' },
            { key: 'expected_return_date', header: 'Debía devolver', tipo: 'date', width: '110px' },
            { key: 'days_overdue',      header: 'Días mora',   tipo: 'days', width: '90px', align: 'center' },
            { key: 'delivered_by_name', header: 'Entregó',     width: '120px' },
        ],
        filtros: [
            { key: 'fechaDesde', label: 'Desde', type: 'date' },
            { key: 'fechaHasta', label: 'Hasta', type: 'date' },
        ],
        loader: (svc, f) => svc.getReporteDeudores(f)
    },

    'pre-4': {
        mghCode: 'R-PRE-04',
        columnas: [
            { key: 'loan_number',          header: 'N° Nota',     width: '110px' },
            { key: 'borrower_name',        header: 'Deudor' },
            { key: 'borrower_license',     header: 'Licencia',    width: '100px' },
            { key: 'loan_date',            header: 'F. Préstamo', tipo: 'date', width: '110px' },
            { key: 'actual_return_date',   header: 'F. Devol.',   tipo: 'date', width: '110px' },
            { key: 'days_loaned',          header: 'Días',        tipo: 'number', width: '70px', align: 'center' },
            { key: 'status',               header: 'Estado',      tipo: 'badge',
                badge: { ACTIVE:'bg-blue-100 text-blue-800 border-blue-700', RETURNED:'bg-green-100 text-green-800 border-green-700',
                    OVERDUE:'bg-red-100 text-red-800 border-red-700' } },
        ],
        filtros: [
            { key: 'fechaDesde', label: 'Desde', type: 'date' },
            { key: 'fechaHasta', label: 'Hasta', type: 'date' },
        ],
        loader: (svc, f) => svc.getReportePrestamos(f)
    },

    /* ── Misceláneos ────────────────────────── */
    'mis-1': {
        mghCode: 'MGH-120',
        columnas: [
            { key: 'code',              header: 'Código BOA-M', width: '120px' },
            { key: 'name',              header: 'Nombre' },
            { key: 'brand',             header: 'Marca',         width: '100px' },
            { key: 'part_number',       header: 'P/N',           width: '110px' },
            { key: 'item_type',         header: 'Tipo',          width: '100px' },
            { key: 'quantity_in_stock', header: 'Stock',         tipo: 'number', width: '80px', align: 'center' },
            { key: 'stock_min',         header: 'Mín.',          tipo: 'number', width: '70px', align: 'center' },
            { key: 'unit_of_measure',   header: 'Unidad',        width: '80px' },
            { key: 'location_name',     header: 'Ubicación' },
        ],
        filtros: [
            { key: 'solo_bajo_min', label: 'Bajo stock', type: 'select', options: [
                    { value: '', label: 'Todos' }, { value: 'true', label: 'Solo bajo mínimo' }
                ]}
        ],
        loader: (svc, f) => svc.getReporteMiscelaneos(f)
    },

    'mis-2': {
        mghCode: 'R-MIS-02',
        columnas: [
            { key: 'code',              header: 'Código',  width: '120px' },
            { key: 'name',              header: 'Nombre' },
            { key: 'quantity_in_stock', header: 'Stock actual', tipo: 'number', width: '110px', align: 'center' },
            { key: 'stock_min',         header: 'Mínimo',       tipo: 'number', width: '80px', align: 'center' },
            { key: 'unit_of_measure',   header: 'Unidad',       width: '80px' },
            { key: 'location_name',     header: 'Ubicación' },
        ],
        loader: (svc, f) => svc.getReporteMiscelaneos({ ...f, solo_bajo_min: 'true' })
    },

    'mis-3': {
        mghCode: 'MGH-118',
        columnas: [
            { key: 'date',             header: 'Fecha',         tipo: 'date', width: '100px' },
            { key: 'movement_number',  header: 'N° Nota',       width: '110px' },
            { key: 'miscelaneo_code',  header: 'Código',        width: '120px' },
            { key: 'miscelaneo_name',  header: 'Material' },
            { key: 'quantity',         header: 'Cant.',         tipo: 'number', width: '70px', align: 'center' },
            { key: 'unit_of_measure',  header: 'Unid.',         width: '70px' },
            { key: 'name',             header: 'Recibido por' },
            { key: 'supplier',         header: 'Proveedor' },
            { key: 'invoice_number',   header: 'N° Factura',    width: '110px' },
        ],
        filtros: [
            { key: 'fechaDesde', label: 'Desde', type: 'date' },
            { key: 'fechaHasta', label: 'Hasta', type: 'date' },
        ],
        loader: (svc, f) => svc.getReporteMovimientosMisc('ENTRADA', f)
    },

    'mis-4': {
        mghCode: 'MGH-121',
        columnas: [
            { key: 'date',             header: 'Fecha',         tipo: 'date', width: '100px' },
            { key: 'movement_number',  header: 'N° Nota',       width: '110px' },
            { key: 'miscelaneo_code',  header: 'Código',        width: '120px' },
            { key: 'miscelaneo_name',  header: 'Material' },
            { key: 'quantity',         header: 'Cant.',         tipo: 'number', width: '70px', align: 'center' },
            { key: 'unit_of_measure',  header: 'Unid.',         width: '70px' },
            { key: 'name',             header: 'Técnico' },
            { key: 'license_number',   header: 'Licencia',      width: '100px' },
            { key: 'area',             header: 'Área',          width: '100px' },
            { key: 'aircraft',         header: 'Aeronave',      width: '80px' },
            { key: 'work_order_number',header: 'OT',            width: '110px' },
            { key: 'authorized_by',    header: 'Autorizó' },
        ],
        filtros: [
            { key: 'fechaDesde', label: 'Desde', type: 'date' },
            { key: 'fechaHasta', label: 'Hasta', type: 'date' },
        ],
        loader: (svc, f) => svc.getReporteMovimientosMisc('SALIDA', f)
    },

    /* ── Kits ───────────────────────────────── */
    'kit-1': {
        mghCode: 'R-KIT-01',
        columnas: [
            { key: 'code',                    header: 'Código',         width: '110px' },
            { key: 'name',                    header: 'Nombre' },
            { key: 'category',                header: 'Categoría',      width: '120px' },
            { key: 'status',                  header: 'Estado',         tipo: 'badge',
                badge: { complete:'bg-green-100 text-green-800 border-green-700',
                    incomplete:'bg-yellow-100 text-yellow-800 border-yellow-700',
                    in_use:'bg-blue-100 text-blue-800 border-blue-700',
                    in_calibration:'bg-purple-100 text-purple-800 border-purple-700' } },
            { key: 'present_components',      header: 'Comp.',          tipo: 'number', width: '70px', align: 'center' },
            { key: 'completeness_percentage', header: '% Completo',     tipo: 'number', width: '100px', align: 'center' },
            { key: 'funcionario_nombre',      header: 'Funcionario' },
            { key: 'location_name',           header: 'Ubicación' },
        ],
        loader: (svc, f) => svc.getReporteKits(f)
    },

    'kit-2': {
        mghCode: 'R-KIT-02',
        columnas: [
            { key: 'code',                    header: 'Código',    width: '110px' },
            { key: 'name',                    header: 'Nombre' },
            { key: 'present_components',      header: 'Presentes', tipo: 'number', width: '90px', align: 'center' },
            { key: 'completeness_percentage', header: '% Completo', tipo: 'number', width: '100px', align: 'center' },
            { key: 'funcionario_nombre',      header: 'Funcionario' },
        ],
        loader: (svc, f) => svc.getReporteKits({ ...f, solo_incompletos: 'true' })
    },

    'kit-3': {
        mghCode: 'R-KIT-03',
        columnas: [
            { key: 'code',               header: 'Código',     width: '110px' },
            { key: 'name',               header: 'Nombre' },
            { key: 'category',           header: 'Categoría',  width: '120px' },
            { key: 'funcionario_nombre', header: 'En uso por' },
            { key: 'location_name',      header: 'Ubicación' },
        ],
        loader: (svc, f) => svc.getReporteKits({ ...f, status: 'in_use' })
    },

    /* ── Movimientos ────────────────────────── */
    'mov-1': {
        mghCode: 'MGH-114',
        columnas: [
            { key: 'movement_number',   header: 'N° Nota',       width: '120px' },
            { key: 'date',              header: 'Fecha',          tipo: 'date', width: '100px' },
            { key: 'type',              header: 'Tipo',           width: '90px' },
            { key: 'entry_reason',      header: 'Motivo entrada'  },
            { key: 'received_by_name',  header: 'Recibido por'    },
            { key: 'requested_by_name', header: 'Solicitó'        },
            { key: 'document_number',   header: 'N° Documento',   width: '120px' },
            { key: 'supplier',          header: 'Proveedor'       },
            { key: 'notes',             header: 'Observaciones'   },
        ],
        filtros: [
            { key: 'fechaDesde', label: 'Desde', type: 'date' },
            { key: 'fechaHasta', label: 'Hasta', type: 'date' },
        ],
        loader: (svc, f) => svc.getReporteMovimientos('ENTRADA', f)
    },

    'mov-2': {
        mghCode: 'R-MOV-02',
        columnas: [
            { key: 'movement_number',   header: 'N° Nota',        width: '120px' },
            { key: 'date',              header: 'Fecha',           tipo: 'date', width: '100px' },
            { key: 'type',              header: 'Tipo',            width: '90px' },
            { key: 'exit_reason',       header: 'Motivo salida'    },
            { key: 'technician',        header: 'Técnico'          },
            { key: 'aircraft',          header: 'Aeronave',        width: '90px' },
            { key: 'work_order_number', header: 'OT',              width: '110px' },
            { key: 'authorized_by',     header: 'Autorizó'         },
            { key: 'notes',             header: 'Observaciones'    },
        ],
        filtros: [
            { key: 'fechaDesde', label: 'Desde', type: 'date' },
            { key: 'fechaHasta', label: 'Hasta', type: 'date' },
        ],
        loader: (svc, f) => svc.getReporteMovimientos('SALIDA', f)
    },

    'mov-3': {
        mghCode: 'MGH-110',
        columnas: [
            { key: 'movement_number',   header: 'N° Nota',         width: '120px' },
            { key: 'date',              header: 'Fecha',            tipo: 'date', width: '100px' },
            { key: 'requested_by_name', header: 'Solicitante'       },
            { key: 'department',        header: 'Depto./Destino'    },
            { key: 'aircraft',          header: 'Aeronave',         width: '90px' },
            { key: 'notes',             header: 'Observaciones'     },
        ],
        filtros: [
            { key: 'fechaDesde', label: 'Desde', type: 'date' },
            { key: 'fechaHasta', label: 'Hasta', type: 'date' },
        ],
        loader: (svc, f) => svc.getReporteMovimientos('TRASPASO', f)
    },
};

/* ── Datos inyectados vía MAT_DIALOG_DATA ─────────────────────────────── */
export interface ReporteVisorData {
    reporteId:     string;
    reporteNombre: string;
    reporteCodigo: string;
    bgHeader:      string;
}

/* ─────────────────────────────────────────────────────────────────────── */

@Component({
    selector:    'app-reporte-visor-dialog',
    standalone:  true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule, FormsModule,
        MatDialogModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule
    ],
    styles: [`
        :host { display: flex; flex-direction: column; width: 100%; height: 100%; }
        .neo-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .neo-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .neo-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }
        :host-context(.dark) .neo-scrollbar::-webkit-scrollbar-thumb { background: #64748b; }
        .days-warn  { background: #fef3c7; color: #92400e; border-color: #b45309; }
        .days-alert { background: #fee2e2; color: #991b1b; border-color: #dc2626; }
        .days-ok    { background: #d1fae5; color: #065f46; border-color: #059669; }
    `],
    template: `
        <!-- ════════════════════════════════════════════════════════════════
             REPORTE VISOR DIALOG  — neo-brutalist compact form
        ════════════════════════════════════════════════════════════════ -->
        <div class="bg-stone-100 dark:bg-slate-900 border-[3px] border-black flex flex-col w-full h-full rounded-2xl overflow-hidden font-sans">

            <!-- ── HEADER OSCURO ──────────────────────────────────────────── -->
            <div class="bg-[#0F172AFF] px-4 py-3 flex items-center justify-between shrink-0 border-b-[3px] border-black">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center shrink-0">
                        <mat-icon class="!text-lg text-[#FFC501FF]">bar_chart</mat-icon>
                    </div>
                    <div class="min-w-0">
                        <h2 class="text-sm font-black text-white uppercase tracking-tight leading-tight truncate max-w-[45ch]"
                            [title]="data.reporteNombre">{{ data.reporteNombre }}</h2>
                        <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span class="px-1.5 py-0.5 text-[9px] font-black bg-white/20 text-white border border-white/30 rounded uppercase shrink-0">
            {{ data.reporteCodigo }}
          </span>
                            <span *ngIf="config?.mghCode"
                                  class="px-1.5 py-0.5 text-[9px] font-black bg-[#FFC501FF] text-black border border-black/20 rounded uppercase shrink-0">
            {{ config!.mghCode }}
          </span>
                            <span class="text-[9px] font-bold text-slate-400 hidden sm:inline">{{ today }}</span>
                        </div>
                    </div>
                </div>
                <button (click)="close()"
                        class="w-8 h-8 flex items-center justify-center bg-white/10 border-2 border-white/20 rounded-xl
                   hover:bg-red-500 hover:border-red-400 transition-all shrink-0 ml-3">
                    <mat-icon class="!text-base text-white">close</mat-icon>
                </button>
            </div>

            <!-- ── FILTROS ────────────────────────────────────────────────── -->
            <div *ngIf="config?.filtros?.length"
                 class="px-4 py-2.5 bg-white dark:bg-slate-800 border-b-[2px] border-black shrink-0">
                <div class="flex items-center gap-2.5 flex-wrap">

      <span class="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400 dark:text-slate-400 flex items-center gap-1 shrink-0">
        <mat-icon class="!text-xs">filter_list</mat-icon> Filtros
      </span>

                    <ng-container *ngFor="let ff of config!.filtros">

                        <!-- Date -->
                        <div *ngIf="ff.type === 'date'" class="flex items-center gap-1.5">
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 shrink-0">{{ ff.label }}</label>
                            <input type="date" [(ngModel)]="filtros[ff.key]"
                                   class="h-8 px-2.5 text-xs font-bold bg-white dark:bg-slate-700 text-black dark:text-white
                        border-2 border-stone-300 dark:border-slate-600 rounded-xl outline-none
                        hover:border-stone-400 focus:border-black focus:shadow-[2px_2px_0_#000] transition-all">
                        </div>

                        <!-- Select -->
                        <div *ngIf="ff.type === 'select'" class="flex items-center gap-1.5">
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 shrink-0">{{ ff.label }}</label>
                            <select [(ngModel)]="filtros[ff.key]"
                                    class="h-8 px-2.5 text-xs font-bold bg-white dark:bg-slate-700 text-black dark:text-white
                         border-2 border-stone-300 dark:border-slate-600 rounded-xl outline-none cursor-pointer
                         hover:border-stone-400 focus:border-black transition-all">
                                <option *ngFor="let op of ff.options" [ngValue]="op.value">{{ op.label }}</option>
                            </select>
                        </div>

                        <!-- Number -->
                        <div *ngIf="ff.type === 'number'" class="flex items-center gap-1.5">
                            <label class="text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-slate-400 shrink-0">{{ ff.label }}</label>
                            <input type="number" [(ngModel)]="filtros[ff.key]"
                                   class="w-20 h-8 px-2.5 text-xs font-bold bg-white dark:bg-slate-700 text-black dark:text-white
                        border-2 border-stone-300 dark:border-slate-600 rounded-xl outline-none
                        hover:border-stone-400 focus:border-black focus:shadow-[2px_2px_0_#000] transition-all">
                        </div>

                    </ng-container>

                    <!-- Aplicar -->
                    <button (click)="cargar()"
                            class="h-8 px-3 bg-[#0F172AFF] text-[#FFC501FF] font-black text-[10px] uppercase border-2 border-black
                     rounded-xl shadow-[2px_2px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none
                     transition-all flex items-center gap-1 shrink-0">
                        <mat-icon class="!text-xs">search</mat-icon> Aplicar
                    </button>
                    <!-- Limpiar -->
                    <button (click)="limpiarFiltros()"
                            class="h-8 px-3 font-black text-[10px] uppercase border-2 border-stone-300 dark:border-slate-500
                     bg-stone-100 dark:bg-slate-700 text-stone-600 dark:text-slate-300 rounded-xl
                     hover:border-black hover:shadow-[2px_2px_0_#000] hover:bg-stone-200 transition-all shrink-0">
                        Limpiar
                    </button>
                </div>
            </div>

            <!-- ── BARRA DE INFO + EXPORTAR ───────────────────────────────── -->
            <div class="px-4 py-2 bg-[#0F172AFF] border-b-[2px] border-black shrink-0 flex items-center justify-between gap-2">

                <!-- Conteo / loading -->
                <div class="flex items-center gap-2">
                    <mat-spinner *ngIf="loading()" diameter="14"></mat-spinner>
                    <span class="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1">
        <ng-container *ngIf="loading()">Cargando...</ng-container>
        <ng-container *ngIf="!loading()">
          <mat-icon class="!text-[11px] text-[#FFC501FF]">table_rows</mat-icon>
            {{ rows().length }} registros
          <span *ngIf="rows().length > pageSize" class="text-slate-400 font-normal">
            · mostr. {{ pagina() * pageSize + 1 }}–{{ pagina() * pageSize + paginaActual().length }}
          </span>
        </ng-container>
      </span>
                </div>

                <!-- Exportar -->
                <div class="flex items-center gap-1.5 shrink-0">
                    <button (click)="exportCSV()" [disabled]="!rows().length"
                            matTooltip="Exportar Excel (CSV)"
                            class="h-6 px-2.5 bg-emerald-500 text-white font-black text-[9px] uppercase border-2 border-black
                     rounded-lg shadow-[2px_2px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none
                     transition-all flex items-center gap-0.5 disabled:opacity-40 disabled:pointer-events-none">
                        <mat-icon class="!text-[10px]">table_view</mat-icon>
                        <span class="hidden sm:inline">Excel</span>
                    </button>
                    <button (click)="exportPDF()"
                            matTooltip="Exportar PDF"
                            class="h-6 px-2.5 bg-red-600 text-white font-black text-[9px] uppercase border-2 border-black
                     rounded-lg shadow-[2px_2px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none
                     transition-all flex items-center gap-0.5">
                        <mat-icon class="!text-[10px]">picture_as_pdf</mat-icon>
                        <span class="hidden sm:inline">PDF</span>
                    </button>
                </div>
            </div>

            <!-- ── TABLA ──────────────────────────────────────────────────── -->
            <div class="flex-1 overflow-auto neo-scrollbar relative bg-stone-50 dark:bg-slate-900">

                <!-- Spinner overlay -->
                <div *ngIf="loading()"
                     class="absolute inset-0 flex items-center justify-center bg-stone-100/80 dark:bg-slate-900/80 z-20">
                    <div class="flex flex-col items-center gap-3 bg-white dark:bg-slate-800 border-[3px] border-black rounded-2xl px-8 py-6"
                         style="box-shadow: 4px 4px 0 0 #000">
                        <mat-spinner diameter="32"></mat-spinner>
                        <p class="text-[11px] font-black uppercase text-black dark:text-white tracking-widest">Consultando...</p>
                    </div>
                </div>

                <!-- Empty state -->
                <div *ngIf="!loading() && !rows().length"
                     class="flex flex-col items-center justify-center py-14">
                    <div class="w-12 h-12 bg-stone-200 dark:bg-slate-700 border-[3px] border-black rounded-xl flex items-center justify-center mb-3"
                         style="box-shadow: 3px 3px 0 0 #000">
                        <mat-icon class="!text-xl text-stone-400 dark:text-slate-400">inbox</mat-icon>
                    </div>
                    <p class="text-xs font-black uppercase text-stone-500 dark:text-slate-400 tracking-widest">Sin resultados</p>
                    <p class="text-[10px] font-bold text-stone-400 dark:text-slate-500 mt-1">Prueba cambiando los filtros</p>
                </div>

                <!-- Data table -->
                <table *ngIf="!loading() && rows().length" class="w-full text-[11px]">
                    <thead class="sticky top-0 z-10">
                    <tr class="bg-stone-200 dark:bg-slate-700 border-b-[2px] border-black text-left">
                        <th class="px-3 py-2.5 text-center font-black uppercase tracking-wider text-black dark:text-white border-r border-black/10 w-9 shrink-0">#</th>
                        <th *ngFor="let col of config!.columnas"
                            class="px-3 py-2.5 font-black uppercase tracking-wider text-black dark:text-white border-r border-black/10 whitespace-nowrap"
                            [style.min-width]="col.width ?? 'auto'"
                            [class.text-center]="col.align === 'center'"
                            [class.text-right]="col.align === 'right'">
                            {{ col.header }}
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr *ngFor="let row of paginaActual(); let i = index"
                        class="border-b border-stone-200 dark:border-slate-700 transition-colors"
                        [ngClass]="i % 2 === 0
              ? 'bg-white dark:bg-slate-800/40 hover:bg-amber-50 dark:hover:bg-slate-800'
              : 'bg-stone-50 dark:bg-slate-800/20 hover:bg-amber-50 dark:hover:bg-slate-800'">

                        <!-- N° fila -->
                        <td class="px-3 py-2 text-center text-stone-400 font-bold border-r border-black/5 text-[10px] whitespace-nowrap">
                            {{ pagina() * pageSize + i + 1 }}
                        </td>

                        <!-- Columnas de datos -->
                        <td *ngFor="let col of config!.columnas"
                            class="px-3 py-2 border-r border-black/5 max-w-[220px]"
                            [class.text-center]="col.align === 'center'"
                            [class.text-right]="col.align === 'right'">

                            <!-- Badge -->
                            <ng-container *ngIf="col.tipo === 'badge'">
              <span class="px-1.5 py-0.5 font-black text-[9px] uppercase border rounded whitespace-nowrap"
                    [ngClass]="col.badge?.[row[col.key]] ?? 'bg-stone-100 text-stone-600 border-stone-400'">
                {{ statusLabel(row[col.key]) }}
              </span>
                            </ng-container>

                            <!-- Days -->
                            <ng-container *ngIf="col.tipo === 'days'">
              <span class="px-1.5 py-0.5 font-black text-[9px] border rounded whitespace-nowrap"
                    [ngClass]="getDaysClass(row[col.key])">
                {{ row[col.key] != null ? row[col.key] + 'd' : '—' }}
              </span>
                            </ng-container>

                            <!-- Date -->
                            <ng-container *ngIf="col.tipo === 'date'">
              <span class="font-bold text-stone-600 dark:text-slate-300 whitespace-nowrap">
                {{ row[col.key] ? (row[col.key] | date:'dd/MM/yy') : '—' }}
              </span>
                            </ng-container>

                            <!-- Bool -->
                            <ng-container *ngIf="col.tipo === 'bool'">
                                <mat-icon class="!text-sm" [ngClass]="row[col.key] ? 'text-green-600' : 'text-stone-300'">
                                    {{ row[col.key] ? 'check_circle' : 'remove' }}
                                </mat-icon>
                            </ng-container>

                            <!-- Number -->
                            <ng-container *ngIf="col.tipo === 'number'">
                                <span class="font-black text-black dark:text-white">{{ row[col.key] ?? '—' }}</span>
                            </ng-container>

                            <!-- Text (default) -->
                            <ng-container *ngIf="!col.tipo || col.tipo === 'text'">
              <span class="text-stone-700 dark:text-slate-300 truncate block" [title]="row[col.key] || ''">
                {{ row[col.key] || '—' }}
              </span>
                            </ng-container>

                        </td>
                    </tr>
                    </tbody>
                </table>
            </div>

            <!-- ── PAGINACIÓN ──────────────────────────────────────────────── -->
            <div *ngIf="rows().length > pageSize"
                 class="px-4 py-2.5 bg-white dark:bg-slate-800 border-t-[2px] border-black flex items-center justify-between shrink-0 rounded-b-2xl">
    <span class="text-[10px] font-bold text-stone-400 uppercase hidden sm:inline">
      {{ rows().length }} registros · pág. {{ pagina() + 1 }}/{{ totalPaginas() }}
    </span>
                <div class="flex items-center gap-1.5 mx-auto sm:mx-0">
                    <button (click)="prevPage()" [disabled]="pagina() === 0"
                            class="h-7 px-3 text-[10px] font-black uppercase bg-white dark:bg-slate-700 border-2 border-black rounded-lg
                     shadow-[2px_2px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none
                     transition-all disabled:opacity-40 disabled:pointer-events-none text-black dark:text-white">
                        ← Ant.
                    </button>
                    <span class="h-7 px-3 text-[10px] font-black bg-[#0F172AFF] text-[#FFC501FF] border-2 border-black rounded-lg flex items-center">
        {{ pagina() + 1 }} / {{ totalPaginas() }}
      </span>
                    <button (click)="nextPage()" [disabled]="pagina() >= totalPaginas() - 1"
                            class="h-7 px-3 text-[10px] font-black uppercase bg-white dark:bg-slate-700 border-2 border-black rounded-lg
                     shadow-[2px_2px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none
                     transition-all disabled:opacity-40 disabled:pointer-events-none text-black dark:text-white">
                        Sig. →
                    </button>
                </div>
            </div>

        </div><!-- /host -->
    `
})
export class ReporteVisorDialogComponent implements OnInit {

    public data   = inject<ReporteVisorData>(MAT_DIALOG_DATA);
    private svc   = inject(ReportesService);
    private ref   = inject(MatDialogRef<ReporteVisorDialogComponent>);
    private cdr   = inject(ChangeDetectorRef);

    /** Mapa de traducción de valores de estado al español */
    readonly statusLabels = STATUS_LABELS;

    config:  ReporteConfig | null = null;
    filtros: FiltrosReporte = {};
    loading  = signal(false);
    rows     = signal<any[]>([]);

    /* pagina como signal → paginaActual reacciona correctamente */
    pagina   = signal(0);
    readonly pageSize = 50;

    today = new Date().toLocaleDateString('es-BO');

    paginaActual = computed(() =>
        this.rows().slice(this.pagina() * this.pageSize, (this.pagina() + 1) * this.pageSize)
    );

    totalPaginas = computed(() =>
        Math.max(1, Math.ceil(this.rows().length / this.pageSize))
    );

    ngOnInit(): void {
        this.config = REPORTE_CONFIGS[this.data.reporteId] ?? null;

        // Inicializar defaults de filtros
        if (this.config?.filtros) {
            for (const ff of this.config.filtros) {
                if (ff.default !== undefined) {
                    this.filtros[ff.key] = ff.default;
                }
            }
        }
        this.cargar();
    }

    cargar(): void {
        if (!this.config) return;
        this.loading.set(true);
        this.pagina.set(0);
        this.config.loader(this.svc, { ...this.filtros })
            .pipe(finalize(() => { this.loading.set(false); this.cdr.markForCheck(); }))
            .subscribe((data: any[]) => {
                this.rows.set(data ?? []);
                this.cdr.markForCheck();
            });
    }

    limpiarFiltros(): void {
        this.filtros = {};
        this.cargar();
    }

    prevPage(): void {
        if (this.pagina() > 0) this.pagina.update(p => p - 1);
    }
    nextPage(): void {
        if (this.pagina() < this.totalPaginas() - 1) this.pagina.update(p => p + 1);
    }

    getDaysClass(days: number | null): string {
        if (days == null) return 'bg-stone-100 text-stone-500 border-stone-400';
        if (days < 0)    return 'days-alert';
        if (days <= 30)  return 'days-warn';
        return 'days-ok';
    }

    /** Devuelve la etiqueta en español de un valor de estado, o el valor original si no existe en el mapa. */
    statusLabel(value: string | null | undefined): string {
        if (value == null) return '—';
        return this.statusLabels[value] ?? value;
    }

    exportCSV(): void {
        if (!this.config || !this.rows().length) return;
        const cols = this.config.columnas.map(c => ({ key: c.key, header: c.header }));
        this.svc.exportarExcel(
            this.rows(),
            cols,
            this.data.reporteCodigo.toLowerCase().replace(/\W+/g, '_')
        );
    }

    exportPDF(): void {
        this.svc.exportarPDF(this.data.reporteId, this.filtros);
    }

    close(): void { this.ref.close(); }
}
