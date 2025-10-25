/**
 * Estado de la aeronave
 */
export type AircraftStatus =
    | 'active'          // Activa
    | 'maintenance'     // En mantenimiento
    | 'grounded'        // En tierra
    | 'decommissioned'; // Fuera de servicio

/**
 * Tipo de aeronave
 */
export type AircraftType =
    | 'passenger'   // Pasajeros
    | 'cargo'       // Carga
    | 'mixed';      // Mixto

/**
 * Aeronave
 */
export interface Aircraft {
    id: string;
    registration: string; // Matrícula (ej: CP-2554)
    manufacturer: string; // Fabricante (ej: Boeing, Airbus)
    model: string; // Modelo (ej: 737-800, A320)
    serialNumber?: string; // Número de serie
    type: AircraftType;

    // Información operativa
    status: AircraftStatus;
    baseLocation?: string; // Base principal
    currentLocation?: string; // Ubicación actual

    // Fechas
    manufactureDate?: string;
    acquisitionDate?: string;
    lastMaintenanceDate?: string;
    nextMaintenanceDate?: string;

    // Capacidades
    passengerCapacity?: number;
    cargoCapacity?: number; // En kg
    fuelCapacity?: number; // En litros

    // Horas de vuelo
    totalFlightHours?: number;
    totalCycles?: number;

    // Información adicional
    owner?: string;
    operator?: string;
    notes?: string;

    // Metadata
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Filtros para búsqueda de aeronaves
 */
export interface AircraftFilters {
    search?: string;
    status?: AircraftStatus;
    type?: AircraftType;
    baseLocation?: string;
    manufacturer?: string;
}
