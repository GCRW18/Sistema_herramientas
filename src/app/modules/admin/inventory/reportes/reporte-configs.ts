/* ── Tipos de columna ──────────────────────────────────────────────────── */
export interface ColDef {
    key:    string;
    header: string;
    width?: string;
    tipo?:  'text' | 'number' | 'date' | 'badge' | 'days' | 'bool';
    badge?: Record<string, string>;
    align?: 'left' | 'center' | 'right';
}

/* ── Config de cada reporte ──────────────────────────────────────────────
 * Las filas salen de ACTreportes::listarReporte (tipo_reporte = id del sub-reporte); el PDF usa
 * la misma consulta, así grilla y PDF coinciden. Columnas y criterios según los formularios MGH
 * del sistema en Excel (Formularios.xlsx). */
export interface ReporteConfig {
    mghCode:  string;
    columnas: ColDef[];
    filtros?: FilterField[];
}

export interface FilterField {
    key:      string;
    label:    string;
    type:     'date' | 'select' | 'number';
    options?: { value: any; label: string }[];
    /** Valor inicial; 'inicioMes' / 'finMes' / 'hoy' se resuelven al abrir el reporte. */
    default?: any;
    /** Opciones que se cargan del backend (p. ej. las bases con herramientas). */
    opcionesDe?: 'bases';
}

/* ── Etiquetas en español de los valores crudos del API ───────────────── */
export const STATUS_LABELS: Record<string, string> = {
    // Herramientas
    available: 'Disponible', disponible: 'Disponible', in_use: 'En uso',
    in_calibration: 'En calibración', calibracion: 'En calibración',
    in_maintenance: 'Mantenimiento', maintenance: 'Mantenimiento',
    quarantine: 'Cuarentena', cuarentena: 'Cuarentena',
    decommissioned: 'Baja', baja: 'Baja', lost: 'Perdida',
    // Condición
    new: 'Nuevo', excellent: 'Excelente', good: 'Bueno', fair: 'Regular', poor: 'Malo',
    damaged: 'Dañado', reconditioned: 'Reacondicionado', used: 'Usado',
    // Préstamos
    active: 'Activo', returned: 'Devuelto', overdue: 'En mora', partial: 'Parcial',
    internal: 'Técnico BOA', external: 'Externo', third_party: 'Terceros',
    // Kits
    complete: 'Completo', incomplete: 'Incompleto',
    // Motivos de movimiento
    purchase: 'Compra', return: 'Devolución', adjustment: 'Ajuste', donation: 'Donación',
    calibration_return: 'Retorno calibración', technician_return: 'Devolución técnico',
    third_party_return: 'Devolución terceros', base_return: 'Retorno de base', new_registration: 'Registro nuevo',
    loan: 'Préstamo', transfer: 'Traspaso', sale: 'Venta', calibration_send: 'Envío calibración',
    maintenance_send: 'Envío mantenimiento', decommission: 'Baja', consumption: 'Consumo',
    base_send: 'Envío a base', area_transfer: 'Traspaso de área',
};

/* ── Colores de insignia (valores reales del API, en minúscula) ────────── */
const B_TOOL: Record<string, string> = {
    available: 'bg-green-100 text-green-800 border-green-700', disponible: 'bg-green-100 text-green-800 border-green-700',
    in_use: 'bg-blue-100 text-blue-800 border-blue-700',
    in_calibration: 'bg-purple-100 text-purple-800 border-purple-700', calibracion: 'bg-purple-100 text-purple-800 border-purple-700',
    in_maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-700',
    quarantine: 'bg-red-100 text-red-800 border-red-700', cuarentena: 'bg-red-100 text-red-800 border-red-700',
    decommissioned: 'bg-gray-200 text-gray-700 border-gray-500', baja: 'bg-gray-200 text-gray-700 border-gray-500',
    lost: 'bg-gray-200 text-gray-700 border-gray-500',
};
const B_COND: Record<string, string> = {
    new: 'bg-teal-100 text-teal-800 border-teal-600', excellent: 'bg-teal-100 text-teal-800 border-teal-600',
    good: 'bg-green-100 text-green-800 border-green-700', fair: 'bg-yellow-100 text-yellow-800 border-yellow-700',
    poor: 'bg-orange-100 text-orange-800 border-orange-600', damaged: 'bg-red-100 text-red-800 border-red-700',
    reconditioned: 'bg-purple-100 text-purple-800 border-purple-600',
};
const B_LOAN: Record<string, string> = {
    active: 'bg-blue-100 text-blue-800 border-blue-700', overdue: 'bg-red-100 text-red-800 border-red-700',
    partial: 'bg-yellow-100 text-yellow-800 border-yellow-700', returned: 'bg-green-100 text-green-800 border-green-700',
};
const B_KIT: Record<string, string> = {
    complete: 'bg-green-100 text-green-800 border-green-700', incomplete: 'bg-yellow-100 text-yellow-800 border-yellow-700',
    in_use: 'bg-blue-100 text-blue-800 border-blue-700', in_calibration: 'bg-purple-100 text-purple-800 border-purple-700',
};

/* ── Filtros reutilizables ─────────────────────────────────────────────── */
const F_DESDE: FilterField = { key: 'fechaDesde', label: 'Desde', type: 'date' };
const F_HASTA: FilterField = { key: 'fechaHasta', label: 'Hasta', type: 'date' };
const F_TIPO_PRESTAMO = (def = ''): FilterField => ({
    key: 'tipo_prestamo', label: 'Tipo', type: 'select', default: def, options: [
        { value: '', label: 'Todos' }, { value: 'internal', label: 'Técnico BOA' },
        { value: 'external', label: 'Externo' }, { value: 'third_party', label: 'Terceros' },
    ],
});
const F_ESTADO_TOOL = (conBajas: boolean): FilterField => ({
    key: 'status', label: 'Estado', type: 'select', default: '', options: [
        { value: '', label: 'Todos' }, { value: 'available', label: 'Disponible' },
        { value: 'in_use', label: 'En uso' }, { value: 'in_calibration', label: 'En calibración' },
        { value: 'in_maintenance', label: 'Mantenimiento' }, { value: 'quarantine', label: 'Cuarentena' },
        ...(conBajas ? [{ value: 'decommissioned', label: 'Baja' }, { value: 'lost', label: 'Perdida' }] : []),
    ],
});

// Por defecto CBB, como los listados del Excel; se puede elegir otra base o 'Todas'.
const F_BASE: FilterField = { key: 'base', label: 'Base', type: 'select', default: 'CBB', opcionesDe: 'bases' };

/* ── Columnas reutilizables (herramienta) ──────────────────────────────── */
const C_CODE:  ColDef = { key: 'code',              header: 'Código',              width: '110px' };
const C_NAME:  ColDef = { key: 'name',              header: 'Nombre' };
const C_PN:    ColDef = { key: 'part_number',       header: 'Modelo o P/N',        width: '120px' };
const C_SN:    ColDef = { key: 'serial_number',     header: 'S/N',                 width: '110px' };
const C_BRAND: ColDef = { key: 'brand',             header: 'Marca',               width: '100px' };
const C_CONT:  ColDef = { key: 'content_list',      header: 'Lista de contenido' };
const C_UBIC:  ColDef = { key: 'ubicacion',         header: 'Ubicación' };
const C_UNID:  ColDef = { key: 'unit_of_measure',   header: 'Unidad',              width: '75px', align: 'center' };
const C_CANT:  ColDef = { key: 'quantity_in_stock', header: 'Cantidad', tipo: 'number', width: '75px', align: 'center' };
const C_VTO:   ColDef = { key: 'next_calibration_date', header: 'Vto. calibración', tipo: 'date', width: '100px' };
const C_FAB:   ColDef = { key: 'manufacture_origin', header: 'Fabricación',        width: '105px' };
const C_OBS:   ColDef = { key: 'notes',             header: 'Observaciones' };

/* ─────────────────────────────────────────────────────────────────────── */

export const REPORTE_CONFIGS: Record<string, ReporteConfig> = {

    /* ── Inventario ─────────────────────────── */
    // MGH-108: herramientas en servicio (sin bajas) de fabricación nacional/internacional.
    'inv-1': {
        mghCode: 'MGH-108',
        columnas: [C_CODE, C_NAME, C_PN, C_SN, C_BRAND, C_CONT, C_UBIC, C_UNID, C_CANT, C_VTO, C_FAB, C_OBS],
        filtros: [F_BASE, F_ESTADO_TOOL(false)],
    },

    'inv-2': {
        mghCode: 'R-INV-02',
        columnas: [
            C_CODE, C_NAME, C_PN, C_SN, C_BRAND,
            { key: 'status',    header: 'Estado',    tipo: 'badge', badge: B_TOOL, width: '110px' },
            { key: 'condition', header: 'Condición', tipo: 'badge', badge: B_COND, width: '110px' },
            C_UBIC,
        ],
        filtros: [F_BASE, F_ESTADO_TOOL(true)],
    },

    // MGH-112: en cuarentena, con el N° de reporte de discrepancia.
    'inv-4': {
        mghCode: 'MGH-112',
        columnas: [C_CODE, C_NAME, C_PN, C_SN, C_BRAND, C_CONT, C_UBIC, C_UNID, C_CANT,
            { key: 'report_number', header: 'N° Reporte', width: '110px' }, C_OBS],
        filtros: [F_BASE],
    },

    // MGH-105: fabricación local.
    'inv-5': {
        mghCode: 'MGH-105',
        columnas: [C_CODE, C_NAME, C_PN, C_SN, C_BRAND, C_CONT, C_UBIC, C_UNID, C_CANT, C_FAB, C_OBS],
        filtros: [F_BASE],
    },

    // MGH-115: inventario de una base.
    'inv-6': {
        mghCode: 'MGH-115',
        columnas: [C_CODE, C_NAME, C_PN, C_SN, C_UBIC, C_UNID, C_BRAND,
            { ...C_CANT, header: 'Existencia' }, C_CONT,
            { key: 'base', header: 'Base', width: '70px', align: 'center' }],
        filtros: [F_BASE],
    },

    /* ── Calibración ────────────────────────── */
    'cal-1': {
        mghCode: 'MGH-102',
        columnas: [C_CODE, C_NAME, C_PN, C_SN, C_UBIC, C_CONT, C_CANT, C_VTO,
            { key: 'days_to_calibration_expiry', header: 'Días remanentes', tipo: 'days', width: '95px', align: 'center' },
            C_OBS],
        filtros: [F_BASE],
    },

    'cal-2': {
        mghCode: 'MGH-104',
        columnas: [C_CODE, C_NAME, C_PN, C_SN, C_UBIC, C_UNID, C_CANT, C_VTO,
            { key: 'days_to_calibration_expiry', header: 'Días remanentes', tipo: 'days', width: '95px', align: 'center' },
            { key: 'base', header: 'Base', width: '70px', align: 'center' }, C_OBS],
        filtros: [F_BASE, { key: 'dias_holgura', label: 'Vence en (días)', type: 'number', default: 60 }],
    },

    'cal-3': {
        mghCode: 'R-CAL-03',
        columnas: [C_CODE, C_NAME, C_PN, C_SN, C_UBIC, C_UNID, C_CANT, C_VTO,
            { key: 'days_to_calibration_expiry', header: 'Días', tipo: 'days', width: '80px', align: 'center' },
            { key: 'base', header: 'Base', width: '70px', align: 'center' }, C_OBS],
        filtros: [F_BASE],
    },

    // MGH-103: reporte mensual (vencen en el período; por defecto, el mes en curso).
    'cal-5': {
        mghCode: 'MGH-103',
        columnas: [C_CODE, C_NAME, C_PN, C_SN, C_UBIC, C_UNID, C_CANT, C_VTO,
            { key: 'days_to_calibration_expiry', header: 'Días remanentes', tipo: 'days', width: '95px', align: 'center' },
            { key: 'base', header: 'Base', width: '70px', align: 'center' }, C_OBS],
        filtros: [{ ...F_DESDE, default: 'inicioMes' }, { ...F_HASTA, default: 'finMes' }, F_BASE],
    },

    // MGH-107: sujetas a calibración de una base.
    'cal-7': {
        mghCode: 'MGH-107',
        columnas: [C_CODE, C_NAME, C_PN, C_SN, C_UBIC, C_UNID, C_BRAND, C_VTO,
            { key: 'days_to_calibration_expiry', header: 'Días remanentes', tipo: 'days', width: '95px', align: 'center' },
            { key: 'base', header: 'Base', width: '70px', align: 'center' }, C_OBS],
        filtros: [F_BASE],
    },

    // MGH-111: enviadas a calibración y/o reparación (notas abiertas, como el Excel).
    'cal-4': {
        mghCode: 'MGH-111',
        filtros: [{ key: 'trabajo', label: 'Trabajo', type: 'select', default: '', options: [
                { value: '', label: 'Todos' }, { value: 'calibracion', label: 'Calibración' },
                { value: 'reparacion', label: 'Reparación / mantenimiento' },
            ]}],
        columnas: [
            { key: 'send_date',            header: 'Fecha',          tipo: 'date', width: '90px' },
            { key: 'record_number',        header: 'Nota',           width: '110px' },
            { key: 'requested_by_name',    header: 'Nombre' },
            { key: 'supplier_name',        header: 'Empresa' },
            { key: 'work_type',            header: 'Tipo de trabajo', width: '110px' },
            { key: 'expected_return_date', header: 'Retorno aprox.', tipo: 'date', width: '100px' },
            { key: 'delivered_by_name',    header: 'Enviado por' },
            { key: 'tool_code',            header: 'Código',         width: '110px' },
            { key: 'tool_name',            header: 'Descripción' },
            { key: 'part_number',          header: 'Modelo o P/N',   width: '110px' },
            { key: 'tool_serial',          header: 'S/N',            width: '100px' },
            { key: 'notes',                header: 'Observaciones' },
        ],
    },

    /* ── Préstamos ──────────────────────────── */
    'pre-1': {
        mghCode: 'R-PRE-01',
        columnas: [
            { key: 'loan_number',          header: 'N° Nota',      width: '110px' },
            { key: 'loan_type',            header: 'Tipo',         tipo: 'badge', width: '100px' },
            { key: 'borrower_name',        header: 'Nombre' },
            { key: 'borrower_license',     header: 'CI / Licencia', width: '100px' },
            { key: 'department',           header: 'Área' },
            { key: 'aircraft',             header: 'Aeronave',     width: '85px' },
            { key: 'work_order_number',    header: 'OT',           width: '100px' },
            { key: 'loan_date',            header: 'F. préstamo',  tipo: 'date', width: '95px' },
            { key: 'expected_return_date', header: 'F. dev. est.', tipo: 'date', width: '95px' },
            { key: 'days_overdue',         header: 'Días mora',    tipo: 'days', width: '80px', align: 'center' },
            { key: 'status',               header: 'Estado',       tipo: 'badge', badge: B_LOAN, width: '90px' },
        ],
        filtros: [F_TIPO_PRESTAMO(), F_DESDE, F_HASTA],
    },

    // MGH-106: una fila por herramienta prestada sin devolver (como el Excel).
    'pre-2': {
        mghCode: 'MGH-106',
        columnas: [
            { key: 'loan_date',        header: 'Fecha',          tipo: 'date', width: '85px' },
            { key: 'loan_time',        header: 'Hora',           width: '55px', align: 'center' },
            { key: 'loan_number',      header: 'Nota',           width: '105px' },
            { key: 'borrower_name',    header: 'Nombre' },
            { key: 'borrower_license', header: 'CI / Licencia',  width: '95px' },
            { key: 'department',       header: 'Área' },
            { key: 'aircraft',         header: 'Aeronave',       width: '80px' },
            { key: 'code',             header: 'Código',         width: '105px' },
            { key: 'name',             header: 'Descripción' },
            { key: 'part_number',      header: 'Modelo o P/N',   width: '110px' },
            { key: 'serial_number',    header: 'S/N',            width: '100px' },
            { key: 'quantity',         header: 'Cant.',          tipo: 'number', width: '55px', align: 'center' },
            { key: 'days_overdue',     header: 'Días mora',      tipo: 'days', width: '75px', align: 'center' },
            { key: 'notes',            header: 'Observaciones' },
        ],
        filtros: [F_TIPO_PRESTAMO('internal'), F_DESDE, F_HASTA],
    },

    'pre-4': {
        mghCode: 'R-PRE-04',
        columnas: [
            { key: 'loan_number',        header: 'N° Nota',     width: '110px' },
            { key: 'loan_type',          header: 'Tipo',        tipo: 'badge', width: '100px' },
            { key: 'borrower_name',      header: 'Nombre' },
            { key: 'borrower_license',   header: 'CI / Licencia', width: '100px' },
            { key: 'loan_date',          header: 'F. préstamo', tipo: 'date', width: '95px' },
            { key: 'actual_return_date', header: 'F. devolución', tipo: 'date', width: '100px' },
            { key: 'days_loaned',        header: 'Días',        tipo: 'number', width: '60px', align: 'center' },
            { key: 'status',             header: 'Estado',      tipo: 'badge', badge: B_LOAN, width: '90px' },
        ],
        filtros: [F_TIPO_PRESTAMO(), F_DESDE, F_HASTA],
    },

    /* ── Misceláneos ────────────────────────── */
    'mis-1': {
        mghCode: 'MGH-120',
        columnas: [
            { key: 'code',              header: 'Código',       width: '110px' },
            { key: 'name',              header: 'Descripción' },
            { key: 'item_type',         header: 'Tipo',         width: '95px' },
            { key: 'unit_of_measure',   header: 'Unidad',       width: '70px', align: 'center' },
            { key: 'brand',             header: 'Marca',        width: '95px' },
            { key: 'part_number',       header: 'Part number',  width: '110px' },
            { key: 'purchase_type',     header: 'Tipo compra',  width: '110px' },
            { key: 'quantity_in_stock', header: 'Stock',        tipo: 'number', width: '65px', align: 'center' },
            { key: 'stock_min',         header: 'Mín.',         tipo: 'number', width: '55px', align: 'center' },
            { key: 'stock_max',         header: 'Máx.',         tipo: 'number', width: '55px', align: 'center' },
            { key: 'location_name',     header: 'Ubicación' },
            { key: 'notes',             header: 'Observación' },
        ],
    },

    'mis-2': {
        mghCode: 'R-MIS-02',
        columnas: [
            { key: 'code',              header: 'Código',       width: '110px' },
            { key: 'name',              header: 'Descripción' },
            { key: 'quantity_in_stock', header: 'Stock actual', tipo: 'number', width: '100px', align: 'center' },
            { key: 'stock_min',         header: 'Mínimo',       tipo: 'number', width: '75px', align: 'center' },
            { key: 'unit_of_measure',   header: 'Unidad',       width: '75px', align: 'center' },
            { key: 'location_name',     header: 'Ubicación' },
        ],
    },

    'mis-3': {
        mghCode: 'R-MIS-03',
        columnas: [
            { key: 'date',            header: 'Fecha',        tipo: 'date', width: '90px' },
            { key: 'movement_number', header: 'Nota',         width: '105px' },
            { key: 'miscelaneo_code', header: 'Código',       width: '110px' },
            { key: 'miscelaneo_name', header: 'Material' },
            { key: 'quantity',        header: 'Cant.',        tipo: 'number', width: '60px', align: 'center' },
            { key: 'unit_of_measure', header: 'Unidad',       width: '65px', align: 'center' },
            { key: 'name',            header: 'Recibido por' },
            { key: 'supplier',        header: 'Proveedor' },
            { key: 'invoice_number',  header: 'N° Factura',   width: '100px' },
            { key: 'notes',           header: 'Observación' },
        ],
        filtros: [F_DESDE, F_HASTA],
    },

    // MGH-121: salidas de misceláneos.
    'mis-4': {
        mghCode: 'MGH-121',
        columnas: [
            { key: 'date',              header: 'Fecha',          tipo: 'date', width: '85px' },
            { key: 'time',              header: 'Hora',           width: '55px', align: 'center' },
            { key: 'movement_number',   header: 'Nota',           width: '100px' },
            { key: 'miscelaneo_code',   header: 'Código',         width: '105px' },
            { key: 'miscelaneo_name',   header: 'Material' },
            { key: 'name',              header: 'Nombre' },
            { key: 'license_number',    header: 'CI / Licencia',  width: '95px' },
            { key: 'quantity',          header: 'Cant.',          tipo: 'number', width: '55px', align: 'center' },
            { key: 'authorized_by',     header: 'Autorizado por' },
            { key: 'aircraft',          header: 'Aeronave',       width: '80px' },
            { key: 'work_order_number', header: 'Orden trabajo',  width: '100px' },
            { key: 'usr_reg',           header: 'Entregado',      width: '95px' },
            { key: 'notes',             header: 'Observación' },
        ],
        filtros: [F_DESDE, F_HASTA],
    },

    /* ── Kits ───────────────────────────────── */
    'kit-1': {
        mghCode: 'R-KIT-01',
        columnas: [
            { key: 'code',                    header: 'Código',      width: '110px' },
            { key: 'name',                    header: 'Nombre' },
            { key: 'category',                header: 'Categoría',   width: '120px' },
            { key: 'status',                  header: 'Estado',      tipo: 'badge', badge: B_KIT, width: '100px' },
            { key: 'present_components',      header: 'Comp.',       tipo: 'number', width: '65px', align: 'center' },
            { key: 'completeness_percentage', header: '% Completo',  tipo: 'number', width: '90px', align: 'center' },
            { key: 'funcionario_nombre',      header: 'Funcionario' },
            { key: 'location_name',           header: 'Ubicación' },
        ],
    },

    'kit-2': {
        mghCode: 'R-KIT-02',
        columnas: [
            { key: 'code',                    header: 'Código',     width: '110px' },
            { key: 'name',                    header: 'Nombre' },
            { key: 'present_components',      header: 'Presentes',  tipo: 'number', width: '85px', align: 'center' },
            { key: 'total_components',        header: 'Total',      tipo: 'number', width: '65px', align: 'center' },
            { key: 'completeness_percentage', header: '% Completo', tipo: 'number', width: '90px', align: 'center' },
            { key: 'funcionario_nombre',      header: 'Funcionario' },
        ],
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
    },

    /* ── Movimientos ────────────────────────── */
    // MGH-114: herramientas ingresadas en el período (por fecha de ingreso).
    'mov-4': {
        mghCode: 'MGH-114',
        columnas: [C_CODE, C_NAME, C_PN, C_SN, C_BRAND, C_CONT, C_UBIC, C_UNID, C_CANT,
            { key: 'fecha_ingreso', header: 'Fecha ingreso', tipo: 'date', width: '95px' }, C_FAB, C_OBS],
        filtros: [F_BASE, { ...F_DESDE, default: 'inicioMes' }, { ...F_HASTA, default: 'hoy' }],
    },

    // MGH-113: compras de herramientas de fabricación internacional.
    'mov-5': {
        mghCode: 'MGH-113',
        columnas: [
            { key: 'movement_date',   header: 'Fecha ingreso', tipo: 'date', width: '90px' },
            { key: 'movement_number', header: 'Nota',          width: '105px' },
            { key: 'document_number', header: 'CMR',           width: '100px' },
            { key: 'purchase_order',  header: 'PO',            width: '100px' },
            { key: 'description',     header: 'Descripción' },
            { key: 'code',            header: 'Código',        width: '105px' },
            { key: 'part_number',     header: 'Modelo o P/N',  width: '110px' },
            { key: 'serial_number',   header: 'S/N',           width: '100px' },
            { key: 'ubicacion',       header: 'Nivel' },
            { key: 'quantity',        header: 'Cant.',         tipo: 'number', width: '55px', align: 'center' },
            { key: 'notes',           header: 'Observaciones' },
        ],
        filtros: [F_DESDE, F_HASTA],
    },

    'mov-1': {
        mghCode: 'R-MOV-01',
        columnas: [
            { key: 'movement_number',   header: 'N° Nota',        width: '120px' },
            { key: 'date',              header: 'Fecha',          tipo: 'date', width: '90px' },
            { key: 'type',              header: 'Tipo',           width: '130px' },
            { key: 'entry_reason',      header: 'Motivo',         tipo: 'badge', width: '120px' },
            { key: 'received_by_name',  header: 'Recibido por' },
            { key: 'requested_by_name', header: 'Entregó / Solicitó' },
            { key: 'document_number',   header: 'N° Documento',   width: '110px' },
            { key: 'supplier',          header: 'Proveedor' },
            { key: 'notes',             header: 'Observaciones' },
        ],
        filtros: [F_DESDE, F_HASTA],
    },

    'mov-2': {
        mghCode: 'R-MOV-02',
        columnas: [
            { key: 'movement_number',   header: 'N° Nota',        width: '120px' },
            { key: 'date',              header: 'Fecha',          tipo: 'date', width: '90px' },
            { key: 'type',              header: 'Tipo',           width: '130px' },
            { key: 'exit_reason',       header: 'Motivo',         tipo: 'badge', width: '120px' },
            { key: 'requested_by_name', header: 'Solicitante' },
            { key: 'aircraft',          header: 'Aeronave',       width: '85px' },
            { key: 'work_order_number', header: 'OT',             width: '100px' },
            { key: 'authorized_by',     header: 'Autorizó' },
            { key: 'notes',             header: 'Observaciones' },
        ],
        filtros: [F_DESDE, F_HASTA],
    },

    // MGH-110: una fila por herramienta traspasada a otra área (por defecto, solo las no retornadas).
    'mov-3': {
        mghCode: 'MGH-110',
        columnas: [
            { key: 'movement_date',      header: 'Fecha',          tipo: 'date', width: '85px' },
            { key: 'movement_number',    header: 'Nota',           width: '105px' },
            { key: 'solicitante',        header: 'Nombre' },
            { key: 'applicant_license',  header: 'CI / Licencia',  width: '95px' },
            { key: 'applicant_position', header: 'Cargo' },
            { key: 'gerencia_destino',   header: 'Destino' },
            { key: 'origen_nombre',      header: 'Base' },
            { key: 'code',               header: 'Código',         width: '105px' },
            { key: 'description',        header: 'Descripción' },
            { key: 'part_number',        header: 'Modelo o P/N',   width: '110px' },
            { key: 'serial_number',      header: 'S/N',            width: '100px' },
            { key: 'quantity',           header: 'Cant.',          tipo: 'number', width: '55px', align: 'center' },
            { key: 'item_notes',         header: 'Observaciones' },
        ],
        filtros: [
            { key: 'pendientes', label: 'Mostrar', type: 'select', default: 'true', options: [
                    { value: 'true', label: 'Sin retornar' }, { value: 'false', label: 'Todos' },
                ]},
            F_DESDE, F_HASTA,
        ],
    },
};
