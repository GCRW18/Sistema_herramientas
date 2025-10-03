export const calibrationRecords = [
    {
        id: '1',
        toolId: '1',
        tool: {
            id: '1',
            code: 'TOOL-001',
            name: 'Calibrador Digital'
        },
        calibrationDate: new Date('2024-06-15').toISOString(),
        nextCalibrationDate: new Date('2025-06-15').toISOString(),
        calibrationType: 'calibration',
        provider: 'Laboratorio ABC',
        certificateNumber: 'CERT-2024-001',
        result: 'approved',
        cost: 150.00,
        notes: 'Calibración anual exitosa',
        performedBy: 'Juan Pérez',
        createdAt: new Date('2024-06-15').toISOString(),
        updatedAt: new Date('2024-06-15').toISOString()
    },
    {
        id: '2',
        toolId: '2',
        tool: {
            id: '2',
            code: 'TOOL-002',
            name: 'Micrómetro Digital'
        },
        calibrationDate: new Date('2024-08-20').toISOString(),
        nextCalibrationDate: new Date('2025-08-20').toISOString(),
        calibrationType: 'verification',
        provider: 'Laboratorio XYZ',
        certificateNumber: 'CERT-2024-002',
        result: 'approved',
        cost: 120.00,
        notes: 'Verificación semestral',
        performedBy: 'María González',
        createdAt: new Date('2024-08-20').toISOString(),
        updatedAt: new Date('2024-08-20').toISOString()
    },
    {
        id: '3',
        toolId: '3',
        tool: {
            id: '3',
            code: 'TOOL-003',
            name: 'Termómetro Digital'
        },
        calibrationDate: new Date('2024-11-10').toISOString(),
        nextCalibrationDate: new Date('2025-11-10').toISOString(),
        calibrationType: 'calibration',
        provider: 'Laboratorio ABC',
        certificateNumber: 'CERT-2024-003',
        result: 'conditional',
        cost: 180.00,
        notes: 'Requiere ajuste menor',
        performedBy: 'Carlos Ruiz',
        createdAt: new Date('2024-11-10').toISOString(),
        updatedAt: new Date('2024-11-10').toISOString()
    }
];

export const calibrationAlerts = [
    {
        id: '1',
        toolId: '1',
        tool: {
            id: '1',
            code: 'TOOL-001',
            name: 'Calibrador Digital'
        },
        nextCalibrationDate: new Date('2025-06-15').toISOString(),
        daysUntilExpiration: 163,
        severity: 'info',
        isExpired: false
    },
    {
        id: '2',
        toolId: '4',
        tool: {
            id: '4',
            code: 'TOOL-004',
            name: 'Manómetro'
        },
        nextCalibrationDate: new Date('2025-01-05').toISOString(),
        daysUntilExpiration: 2,
        severity: 'critical',
        isExpired: false
    },
    {
        id: '3',
        toolId: '5',
        tool: {
            id: '5',
            code: 'TOOL-005',
            name: 'Balanza Digital'
        },
        nextCalibrationDate: new Date('2024-12-28').toISOString(),
        daysUntilExpiration: -6,
        severity: 'critical',
        isExpired: true
    }
];

export const maintenanceRecords = [
    {
        id: '1',
        toolId: '1',
        toolCode: 'MIC-001',
        toolName: 'Micrómetro Digital 0-25mm',
        type: 'preventive',
        status: 'scheduled',
        scheduledDate: new Date('2025-02-15').toISOString(),
        technician: 'Juan Pérez',
        description: 'Mantenimiento preventivo programado',
        notes: 'Limpieza y calibración de rutina',
        cost: 0,
        createdAt: new Date('2025-01-03').toISOString(),
        updatedAt: new Date('2025-01-03').toISOString()
    },
    {
        id: '2',
        toolId: '2',
        toolCode: 'CAL-002',
        toolName: 'Calibrador Vernier 300mm',
        type: 'corrective',
        status: 'in_progress',
        scheduledDate: new Date('2025-01-10').toISOString(),
        completedDate: null,
        technician: 'María García',
        description: 'Reparación de escala dañada',
        notes: 'Escala presenta rayones profundos',
        cost: 150.00,
        createdAt: new Date('2025-01-08').toISOString(),
        updatedAt: new Date('2025-01-08').toISOString()
    },
    {
        id: '3',
        toolId: '3',
        toolCode: 'BAL-003',
        toolName: 'Balanza Analítica 0.1mg',
        type: 'preventive',
        status: 'completed',
        scheduledDate: new Date('2024-12-20').toISOString(),
        completedDate: new Date('2024-12-20').toISOString(),
        technician: 'Carlos Ruiz',
        description: 'Calibración y limpieza preventiva',
        notes: 'Mantenimiento completado sin inconvenientes',
        cost: 80.00,
        createdAt: new Date('2024-12-15').toISOString(),
        updatedAt: new Date('2024-12-20').toISOString()
    },
    {
        id: '4',
        toolId: '4',
        toolCode: 'TERM-004',
        toolName: 'Termómetro Digital -50/150°C',
        type: 'predictive',
        status: 'scheduled',
        scheduledDate: new Date('2025-02-28').toISOString(),
        technician: 'Ana Martínez',
        description: 'Análisis predictivo de desgaste del sensor',
        notes: 'Revisar exactitud en temperaturas extremas',
        cost: 0,
        createdAt: new Date('2025-01-03').toISOString(),
        updatedAt: new Date('2025-01-03').toISOString()
    },
    {
        id: '5',
        toolId: '5',
        toolCode: 'MAN-005',
        toolName: 'Manómetro Digital 0-1000 PSI',
        type: 'corrective',
        status: 'cancelled',
        scheduledDate: new Date('2024-12-15').toISOString(),
        technician: 'Pedro López',
        description: 'Reparación de válvula de alivio',
        notes: 'Cancelado: herramienta dada de baja',
        cost: 0,
        createdAt: new Date('2024-12-10').toISOString(),
        updatedAt: new Date('2024-12-16').toISOString()
    },
    {
        id: '6',
        toolId: '6',
        toolCode: 'DUR-006',
        toolName: 'Durómetro Rockwell',
        type: 'preventive',
        status: 'scheduled',
        scheduledDate: new Date('2025-03-10').toISOString(),
        technician: 'Juan Pérez',
        description: 'Mantenimiento preventivo anual',
        notes: 'Incluye calibración de penetrador',
        cost: 0,
        createdAt: new Date('2025-01-03').toISOString(),
        updatedAt: new Date('2025-01-03').toISOString()
    },
    {
        id: '7',
        toolId: '7',
        toolCode: 'ESP-007',
        toolName: 'Espectrofotómetro UV-VIS',
        type: 'corrective',
        status: 'in_progress',
        scheduledDate: new Date('2025-01-05').toISOString(),
        technician: 'María García',
        description: 'Reemplazo de lámpara de deuterio',
        notes: 'Lámpara con más de 2000 horas de uso',
        cost: 450.00,
        createdAt: new Date('2025-01-04').toISOString(),
        updatedAt: new Date('2025-01-05').toISOString()
    },
    {
        id: '8',
        toolId: '8',
        toolCode: 'PH-008',
        toolName: 'pH-metro Digital',
        type: 'preventive',
        status: 'completed',
        scheduledDate: new Date('2024-11-20').toISOString(),
        completedDate: new Date('2024-11-20').toISOString(),
        technician: 'Carlos Ruiz',
        description: 'Calibración y limpieza de electrodo',
        notes: 'Electrodo en buen estado',
        cost: 35.00,
        createdAt: new Date('2024-11-15').toISOString(),
        updatedAt: new Date('2024-11-20').toISOString()
    }
];
