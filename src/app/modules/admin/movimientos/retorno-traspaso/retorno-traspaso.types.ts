// Shared types and interfaces for retorno-traspaso dialogs

export type ActiveTab    = 'envio' | 'traspaso' | 'retorno' | 'activos' | 'traspaso-tecnico';
export type TipoOrigen   = 'BASE' | 'TRASPASO';
export type CondRetorno  = 'BUENO' | 'DAÑADO' | 'REQUIERE_CALIBRACION' | 'FALTANTE';

export interface Ubicacion {
    id: string;
    nombre: string;
    codigo: string;
    ciudad?: string;
}

export interface ToolEnvioItem {
    toolId: number;
    codigo: string;
    nombre: string;
    pn: string;
    sn: string;
    marca: string;
    fechaVencCal: string;
    cantidad: number;
    condicion: string;
    notas: string;
}

export interface TraspasoItem {
    id: string;
    filaObs: number;
    toolId?: string;
    codigo: string;
    descripcion: string;
    pn: string;
    sn: string;
    marca?: string;
    cantidadEnviada: number;
    cantidadRetorna: number;
    fechaEnvio: string;
    nroNotaSalida: string;
    ubicacionOrigen: string;
    diasFuera?: number;
    selected: boolean;
    expanded: boolean;
    condicion: CondRetorno | '';
    observacionItem: string;
}

export interface Funcionario {
    id: string;
    nombre: string;
    cargo: string;
}

export interface MovimientoActivo {
    id_movement: number;
    movement_number: string;
    movement_type_label: string;
    transfer_type: string;
    send_date: string;
    expected_return_date: string | null;
    days_remaining: number | null;
    alert_status: string;
    source_warehouse_id?: number;
    destination_warehouse_id?: number;
    source_warehouse_name: string;
    destination_warehouse_name: string;
    requested_by_name: string;
    received_by_name: string;
    department: string;
    document_number: string;
    notes: string;
    specific_observations?: string;
    items_count: number;
    expanded?: boolean;
    isCompleted?: boolean;
    return_movement_number?: string;
    return_id_movement?: number;
}

export interface PersonaTecnico {
    id: string;
    nombre: string;
    cargo: string;
    licencia: string;
    area?: string;
}

export interface ResumenCondicion {
    buenos: number;
    danados: number;
    calibracion: number;
    faltantes: number;
    pendientes: number;
}

export interface HistorialRecord {
    id: string;
    fecha: string;
    tipo: string;
    documento: string;
    responsable: string;
    estado: string;
    raw?: any;
}

export const CONDICIONES_RETORNO = [
    { value: 'BUENO' as CondRetorno,                label: 'Bueno',            bgColor: 'bg-green-500',  icon: 'check_circle',   description: 'Perfecto estado' },
    { value: 'DAÑADO' as CondRetorno,               label: 'Dañado',           bgColor: 'bg-red-500',    icon: 'report_problem', description: 'Requiere reparación' },
    { value: 'REQUIERE_CALIBRACION' as CondRetorno, label: 'Req. Calibración', bgColor: 'bg-yellow-500', icon: 'speed',          description: 'Necesita calibración' },
    { value: 'FALTANTE' as CondRetorno,             label: 'Faltante',         bgColor: 'bg-red-600',    icon: 'help_outline',   description: 'No se encuentra' }
];

export const CONDICIONES_ENVIO = [
    { value: 'excellent', label: 'Excelente' },
    { value: 'good',      label: 'Bueno' },
    { value: 'fair',      label: 'Regular' },
    { value: 'damaged',   label: 'Dañado' },
];

export const TIPOS_TRASPASO = [
    { value: 'TEMPORAL',     label: 'Temporal' },
    { value: 'PERMANENTE',   label: 'Permanente' },
    { value: 'REASIGNACION', label: 'Reasignación' },
    { value: 'PRESTAMO',     label: 'Préstamo Interno' },
];

// Shared item validation helpers
export function isItemValid(item: TraspasoItem): boolean {
    if (!item.selected) return true;
    if (!item.condicion) return false;
    if (item.condicion !== 'FALTANTE' && (item.cantidadRetorna <= 0 || item.cantidadRetorna > item.cantidadEnviada)) return false;
    if ((item.condicion === 'DAÑADO' || item.condicion === 'FALTANTE') && !item.observacionItem.trim()) return false;
    return true;
}

export function getItemErrors(item: TraspasoItem): string[] {
    const e: string[] = [];
    if (!item.selected) return e;
    if (!item.condicion) e.push('Falta Condición');
    if (item.condicion !== 'FALTANTE' && item.cantidadRetorna <= 0) e.push('Cantidad inválida');
    if (item.condicion !== 'FALTANTE' && item.cantidadRetorna > item.cantidadEnviada) e.push('Excede enviado');
    if ((item.condicion === 'DAÑADO' || item.condicion === 'FALTANTE') && !item.observacionItem.trim()) e.push('Falta Observación');
    return e;
}

export function mapRawMovimientoActivo(m: any): MovimientoActivo {
    const isMgh109 = !!(m.specific_observations?.includes('MGH109'));
    const rawType  = m.movement_type_label || m.type || '';
    return {
        id_movement:                Number(m.id_movement),
        movement_number:            m.movement_number  || '',
        movement_type_label:        isMgh109 ? 'MGH_109' : rawType,
        transfer_type:              m.transfer_type    || '',
        send_date:                  m.send_date  || m.date  || '',
        expected_return_date:       m.expected_return_date || null,
        days_remaining:             m.days_remaining != null ? Number(m.days_remaining) : null,
        alert_status:               m.alert_status || 'SIN_FECHA',
        source_warehouse_id:        m.source_warehouse_id,
        destination_warehouse_id:   m.destination_warehouse_id,
        source_warehouse_name:      m.source_warehouse_name      || '',
        destination_warehouse_name: m.destination_warehouse_name || '',
        requested_by_name:          m.requested_by_name  || m.responsible_person || '',
        received_by_name:           m.received_by_name   || '',
        department:                 m.department         || '',
        document_number:            m.document_number    || '',
        notes:                      m.notes              || '',
        specific_observations:      m.specific_observations      || '',
        items_count:                Number(m.items_count) || 0,
        expanded:                   false,
        isCompleted:                m.status === 'returned',
        return_movement_number:     m.return_movement_number || '',
        return_id_movement:         Number(m.return_id_movement) || 0,
    };
}

export function abrirBlob(html: string): void {
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
