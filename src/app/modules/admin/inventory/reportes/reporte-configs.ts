import { ReportesService, FiltrosReporte } from './reportes.service';

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
export interface ReporteConfig {
    mghCode:     string;
    columnas:    ColDef[];
    filtros?:    FilterField[];
    loader:      (svc: ReportesService, f: FiltrosReporte) => any;
    excelCols?:  { key: string; header: string }[];
}

export interface FilterField {
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
        // MGH-112: Listado de herramientas, bancos de prueba y equipos de apoyo en cuarentena.
        mghCode: 'MGH-112',
        columnas: [
            { key: 'code',            header: 'Código',      width: '110px' },
            { key: 'name',            header: 'Nombre' },
            { key: 'model',           header: 'Modelo o P/N', width: '120px' },
            { key: 'serial_number',   header: 'S/N',         width: '110px' },
            { key: 'brand',           header: 'Marca',       width: '100px' },
            { key: 'content_list',    header: 'Lista de contenido' },
            { key: 'estante',         header: 'Ubicación',   width: '100px' },
            { key: 'unit_of_measure', header: 'Unidad',      width: '80px', align: 'center' },
            { key: 'quantity_in_stock', header: 'Cantidad',  tipo: 'number', width: '80px', align: 'center' },
            { key: 'notes',           header: 'Observaciones' },
        ],
        loader: (svc, f) => svc.getReporteHerramientas({ ...f, status: 'quarantine' })
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
        loader: (svc, f) => svc.getReportePrestamos({ ...f, status: 'active' })
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
