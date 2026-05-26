/**
 * reportes-catalogo.config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Catálogo estático de reportes disponibles en el Sistema de Herramientas.
 * Cada entrada describe un reporte (código, nombre, descripción, formato y
 * categoría) pero NO contiene datos — éstos se obtienen del API en tiempo
 * de ejecución a través de REPORTE_CONFIGS (reporte-visor-dialog.component.ts).
 *
 * Para agregar un nuevo reporte:
 *   1. Añadir la entrada aquí con `activo: false` mientras está en desarrollo.
 *   2. Implementar el loader en REPORTE_CONFIGS.
 *   3. Cambiar `activo: true` cuando el backend esté listo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ReporteItem {
    id:          string;
    codigo:      string;
    nombre:      string;
    descripcion: string;
    tipo:        'PDF' | 'EXCEL' | 'AMBOS';
    activo:      boolean;
}

export interface CategoriaReporte {
    id:          string;
    codigo:      string;
    nombre:      string;
    descripcion: string;
    icono:       string;
    bgHeader:    string;
    bgBadge:     string;
    reportes:    ReporteItem[];
}

export const CATALOGO_REPORTES: CategoriaReporte[] = [
    {
        id: 'inventario', codigo: 'INV', nombre: 'INVENTARIO',
        descripcion: 'Inventario maestro de herramientas, equipos y bancos de prueba.',
        icono: 'inventory_2', bgHeader: 'bg-amber-600', bgBadge: 'bg-white text-amber-700',
        reportes: [
            { id: 'inv-1', codigo: 'MGH-108',  nombre: 'Inventario maestro de herramientas y equipos',
              descripcion: 'Listado completo con código, P/N, S/N, estado, ubicación y condición',   tipo: 'EXCEL', activo: true  },
            { id: 'inv-2', codigo: 'R-INV-02', nombre: 'Herramientas por estado y condición',
              descripcion: 'Agrupado por NUEVO · USADO · EN REPARACIÓN · BAJA',                     tipo: 'AMBOS', activo: true  },
            { id: 'inv-3', codigo: 'R-INV-03', nombre: 'Herramientas por almacén y ubicación',
              descripcion: 'Distribución por almacén, estante y nivel de cada base',                 tipo: 'EXCEL', activo: false },
            { id: 'inv-4', codigo: 'MGH-112',  nombre: 'Herramientas en cuarentena u observadas',
              descripcion: 'Items dañados, retenidos o con baja registrada',                         tipo: 'PDF',   activo: true  },
            { id: 'inv-5', codigo: 'MGH-105',  nombre: 'Herramientas de fabricación local',
              descripcion: 'Items fabricados internamente en talleres BOA',                          tipo: 'AMBOS', activo: true  },
            { id: 'inv-6', codigo: 'R-INV-06', nombre: 'Historial de cambios de estado',
              descripcion: 'Auditoría completa de transiciones con responsable, motivo y documento', tipo: 'AMBOS', activo: false },
        ]
    },
    {
        id: 'movimientos', codigo: 'MOV', nombre: 'MOVIMIENTOS',
        descripcion: 'Entradas, salidas, traspasos y ajustes. Trazabilidad completa de cada movimiento.',
        icono: 'swap_horiz', bgHeader: 'bg-blue-700', bgBadge: 'bg-white text-blue-700',
        reportes: [
            { id: 'mov-1', codigo: 'MGH-114',  nombre: 'Registro de entradas al almacén',
              descripcion: 'Recepciones con N° nota, fecha, responsable, P/N y factura',          tipo: 'AMBOS', activo: true  },
            { id: 'mov-2', codigo: 'R-MOV-02', nombre: 'Registro de salidas del almacén',
              descripcion: 'Despachos con licencia, área, orden de trabajo y aeronave',           tipo: 'AMBOS', activo: true  },
            { id: 'mov-3', codigo: 'MGH-110',  nombre: 'Traspasos entre almacenes y bases',
              descripcion: 'Movimientos internos entre bases aeronáuticas y almacenes',            tipo: 'AMBOS', activo: true  },
            { id: 'mov-4', codigo: 'R-MOV-04', nombre: 'Ajustes de stock',
              descripcion: 'Aumentos, reducciones, correcciones y mermas con motivo registrado',  tipo: 'EXCEL', activo: false },
            { id: 'mov-5', codigo: 'R-MOV-05', nombre: 'Historial completo de movimientos',
              descripcion: 'Vista unificada de todos los movimientos: INVENTARIO y KITS',         tipo: 'EXCEL', activo: false },
        ]
    },
    {
        id: 'calibracion', codigo: 'CAL', nombre: 'CALIBRACIÓN',
        descripcion: 'Control y seguimiento de herramientas sujetas a calibración periódica.',
        icono: 'tune', bgHeader: 'bg-[#0F172AFF]', bgBadge: 'bg-[#FFC501FF] text-black',
        reportes: [
            { id: 'cal-1', codigo: 'MGH-102',  nombre: 'Herramientas sujetas a calibración',
              descripcion: 'Inventario con frecuencia en meses, proveedor y N° certificado',    tipo: 'EXCEL', activo: true  },
            { id: 'cal-2', codigo: 'MGH-104',  nombre: 'Herramientas próximas a vencer',
              descripcion: 'Vencimientos en los próximos 30 días con alerta de prioridad',      tipo: 'AMBOS', activo: true  },
            { id: 'cal-3', codigo: 'R-CAL-03', nombre: 'Herramientas con calibración vencida',
              descripcion: 'Equipos fuera de plazo que requieren acción inmediata',              tipo: 'PDF',   activo: true  },
            { id: 'cal-4', codigo: 'MGH-111',  nombre: 'Herramientas actualmente en calibración',
              descripcion: 'Equipos fuera del almacén enviados a calibración externa',           tipo: 'PDF',   activo: true  },
            { id: 'cal-5', codigo: 'R-CAL-05', nombre: 'Herramientas calibradas por período',
              descripcion: 'Histórico de calibraciones realizadas con fechas y proveedores',    tipo: 'AMBOS', activo: false },
            { id: 'cal-6', codigo: 'R-CAL-06', nombre: 'Herramientas sujetas a calibración por base',
              descripcion: 'Control distribuido por base aeronáutica (CBBA, SCZ, LPZ)',        tipo: 'EXCEL', activo: false },
        ]
    },
    {
        id: 'prestamos', codigo: 'PRE', nombre: 'PRÉSTAMOS',
        descripcion: 'Herramientas en préstamo, deudores y equipos en reparación externa.',
        icono: 'assignment_return', bgHeader: 'bg-red-700', bgBadge: 'bg-white text-red-700',
        reportes: [
            { id: 'pre-1', codigo: 'R-PRE-01', nombre: 'Herramientas en préstamo activo',
              descripcion: 'Herramientas fuera del almacén con responsable y fecha de salida',  tipo: 'AMBOS', activo: true  },
            { id: 'pre-2', codigo: 'MGH-106',  nombre: 'Deudores — personal con herramientas pendientes',
              descripcion: 'Personal con herramientas no devueltas, ordenado por días de mora', tipo: 'PDF',   activo: true  },
            { id: 'pre-3', codigo: 'R-PRE-03', nombre: 'Herramientas enviadas a reparación externa',
              descripcion: 'Salidas por mantenimiento con proveedor, estado y fecha estimada',   tipo: 'AMBOS', activo: false },
            { id: 'pre-4', codigo: 'R-PRE-04', nombre: 'Historial de préstamos y devoluciones',
              descripcion: 'Registro histórico de todos los préstamos con resultado',            tipo: 'EXCEL', activo: true  },
        ]
    },
    {
        id: 'kits', codigo: 'KIT', nombre: 'KITS',
        descripcion: 'Gestión de kits de herramientas: composición, estado y préstamos.',
        icono: 'cases', bgHeader: 'bg-violet-700', bgBadge: 'bg-white text-violet-700',
        reportes: [
            { id: 'kit-1', codigo: 'R-KIT-01', nombre: 'Listado completo de kits',
              descripcion: 'Todos los kits con cantidad de ítems, categoría, estado y responsable',  tipo: 'AMBOS', activo: true  },
            { id: 'kit-2', codigo: 'R-KIT-02', nombre: 'Kits incompletos o con faltantes',
              descripcion: 'Kits con ítems faltantes o en estado INCOMPLETO',                        tipo: 'PDF',   activo: true  },
            { id: 'kit-3', codigo: 'R-KIT-03', nombre: 'Kits actualmente en uso o prestados',
              descripcion: 'Kits asignados a personal con fecha, área y orden de trabajo',           tipo: 'AMBOS', activo: true  },
            { id: 'kit-4', codigo: 'R-KIT-04', nombre: 'Kits por categoría y estado',
              descripcion: 'Clasificación por MANTENIMIENTO · LUBRICACIÓN · FRENOS · CALIBRACIÓN',  tipo: 'EXCEL', activo: false },
        ]
    },
    {
        id: 'miscelaneos', codigo: 'MIS', nombre: 'MISCELÁNEOS',
        descripcion: 'Consumibles, repuestos, materiales y químicos. Entradas, salidas y stock mínimo.',
        icono: 'category', bgHeader: 'bg-emerald-700', bgBadge: 'bg-white text-emerald-700',
        reportes: [
            { id: 'mis-1', codigo: 'MGH-120',  nombre: 'Inventario de consumibles y materiales',
              descripcion: 'Listado con código BOA-M, tipo, P/N, stock actual y stock mínimo', tipo: 'EXCEL', activo: true },
            { id: 'mis-2', codigo: 'R-MIS-02', nombre: 'Consumibles bajo stock mínimo',
              descripcion: 'Ítems que requieren reposición urgente por tipo y ubicación',       tipo: 'AMBOS', activo: true },
            { id: 'mis-3', codigo: 'MGH-118',  nombre: 'Registro de entradas de materiales',
              descripcion: 'Recepciones con N° nota, recibido por, marca y factura',            tipo: 'AMBOS', activo: true },
            { id: 'mis-4', codigo: 'MGH-121',  nombre: 'Registro de salidas de materiales',
              descripcion: 'Despachos con N° licencia, área, orden de trabajo y aeronave',      tipo: 'AMBOS', activo: true },
        ]
    },
];
