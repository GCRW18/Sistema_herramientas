export const quarantineRecords = [
    {
        id: '1',
        toolId: '3',
        tool: {
            id: '3',
            code: 'TOOL-003',
            name: 'Termómetro Digital'
        },
        reason: 'calibration_expired',
        description: 'Calibración vencida, requiere nueva certificación',
        reportedDate: new Date('2024-12-20').toISOString(),
        reportedBy: 'Juan Pérez',
        expectedResolutionDate: new Date('2025-01-15').toISOString(),
        status: 'active',
        notes: 'Pendiente de envío a laboratorio',
        createdAt: new Date('2024-12-20').toISOString(),
        updatedAt: new Date('2024-12-20').toISOString()
    },
    {
        id: '2',
        toolId: '4',
        tool: {
            id: '4',
            code: 'TOOL-004',
            name: 'Manómetro'
        },
        reason: 'damage',
        description: 'Daño en carátula, lectura incorrecta',
        reportedDate: new Date('2024-11-15').toISOString(),
        reportedBy: 'María González',
        expectedResolutionDate: new Date('2024-12-30').toISOString(),
        resolvedDate: new Date('2024-12-25').toISOString(),
        status: 'resolved',
        resolution: 'Reparado y calibrado',
        notes: 'Herramienta reparada exitosamente',
        createdAt: new Date('2024-11-15').toISOString(),
        updatedAt: new Date('2024-12-25').toISOString()
    },
    {
        id: '3',
        toolId: '5',
        tool: {
            id: '5',
            code: 'TOOL-005',
            name: 'Balanza Digital'
        },
        reason: 'quality_issue',
        description: 'Variación significativa en mediciones repetidas',
        reportedDate: new Date('2024-12-28').toISOString(),
        reportedBy: 'Carlos Ruiz',
        expectedResolutionDate: new Date('2025-01-20').toISOString(),
        status: 'active',
        notes: 'En investigación',
        createdAt: new Date('2024-12-28').toISOString(),
        updatedAt: new Date('2024-12-28').toISOString()
    }
];

export const decommissionRecords = [
    {
        id: '1',
        toolId: '6',
        tool: {
            id: '6',
            code: 'TOOL-006',
            name: 'Calibrador Analógico Antiguo'
        },
        reason: 'obsolescencia',
        date: new Date('2024-10-15').toISOString(),
        requestedBy: 'Ana Martínez',
        approvedBy: 'Director Técnico',
        status: 'approved',
        notes: 'Herramienta obsoleta, reemplazada por modelo digital',
        createdAt: new Date('2024-10-01').toISOString(),
        updatedAt: new Date('2024-10-15').toISOString()
    },
    {
        id: '2',
        toolId: '7',
        tool: {
            id: '7',
            code: 'TOOL-007',
            name: 'Micrómetro Mecánico'
        },
        reason: 'daño irreparable',
        date: new Date('2024-09-20').toISOString(),
        requestedBy: 'Pedro López',
        approvedBy: 'Jefe de Mantenimiento',
        status: 'approved',
        notes: 'Daño irreparable en mecanismo de medición',
        createdAt: new Date('2024-09-15').toISOString(),
        updatedAt: new Date('2024-09-20').toISOString()
    }
];
