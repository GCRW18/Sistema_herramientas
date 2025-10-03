export const movements = [
    {
        id: '1',
        movementNumber: 'MOV-2025-001',
        type: 'entry',
        status: 'completed',
        date: new Date('2025-01-15').toISOString(),
        effectiveDate: new Date('2025-01-15').toISOString(),
        entryReason: 'purchase',
        requestedById: 'user1',
        responsiblePerson: 'Juan Pérez',
        supplier: 'Proveedor ABC',
        notes: 'Compra de calibradores nuevos',
        tool: {
            id: '1',
            code: 'MIC-001',
            name: 'Micrómetro Digital 0-25mm'
        },
        items: [
            {
                id: 'item1',
                movementId: '1',
                toolId: '1',
                quantity: 5,
                notes: 'Herramientas nuevas en caja'
            }
        ],
        createdAt: new Date('2025-01-15').toISOString(),
        updatedAt: new Date('2025-01-15').toISOString()
    },
    {
        id: '2',
        movementNumber: 'MOV-2025-002',
        type: 'exit',
        status: 'completed',
        date: new Date('2025-01-20').toISOString(),
        effectiveDate: new Date('2025-01-20').toISOString(),
        exitReason: 'loan',
        requestedById: 'user2',
        responsiblePerson: 'María González',
        recipient: 'Departamento de Producción',
        expectedReturnDate: new Date('2025-02-20').toISOString(),
        notes: 'Préstamo para proyecto especial',
        tool: {
            id: '2',
            code: 'CAL-002',
            name: 'Calibrador Vernier 300mm'
        },
        items: [
            {
                id: 'item2',
                movementId: '2',
                toolId: '2',
                quantity: 1,
                notes: 'Préstamo temporal'
            }
        ],
        createdAt: new Date('2025-01-20').toISOString(),
        updatedAt: new Date('2025-01-20').toISOString()
    },
    {
        id: '3',
        movementNumber: 'MOV-2025-003',
        type: 'entry',
        status: 'completed',
        date: new Date('2025-01-25').toISOString(),
        effectiveDate: new Date('2025-01-25').toISOString(),
        entryReason: 'return',
        requestedById: 'user3',
        responsiblePerson: 'Carlos Ruiz',
        notes: 'Devolución de préstamo',
        tool: {
            id: '2',
            code: 'CAL-002',
            name: 'Calibrador Vernier 300mm'
        },
        items: [
            {
                id: 'item3',
                movementId: '3',
                toolId: '2',
                quantity: 1,
                notes: 'Devuelto en buen estado'
            }
        ],
        createdAt: new Date('2025-01-25').toISOString(),
        updatedAt: new Date('2025-01-25').toISOString()
    },
    {
        id: '4',
        movementNumber: 'MOV-2025-004',
        type: 'exit',
        status: 'pending',
        date: new Date('2025-01-28').toISOString(),
        exitReason: 'calibration_send',
        requestedById: 'user4',
        responsiblePerson: 'Ana Martínez',
        supplier: 'Laboratorio XYZ',
        expectedReturnDate: new Date('2025-03-10').toISOString(),
        notes: 'Envío a calibración anual',
        tool: {
            id: '3',
            code: 'BAL-003',
            name: 'Balanza Analítica 0.1mg'
        },
        items: [
            {
                id: 'item4',
                movementId: '4',
                toolId: '3',
                quantity: 1,
                notes: 'Calibración programada'
            }
        ],
        createdAt: new Date('2025-01-28').toISOString(),
        updatedAt: new Date('2025-01-28').toISOString()
    },
    {
        id: '5',
        movementNumber: 'MOV-2025-005',
        type: 'transfer',
        status: 'approved',
        date: new Date('2025-02-01').toISOString(),
        requestedById: 'user1',
        responsiblePerson: 'Juan Pérez',
        sourceWarehouseId: 'w1',
        destinationWarehouseId: 'w2',
        notes: 'Transferencia entre almacenes',
        tool: {
            id: '4',
            code: 'TERM-004',
            name: 'Termómetro Digital -50/150°C'
        },
        items: [
            {
                id: 'item5',
                movementId: '5',
                toolId: '4',
                quantity: 2,
                notes: 'Reorganización de inventario'
            }
        ],
        createdAt: new Date('2025-02-01').toISOString(),
        updatedAt: new Date('2025-02-01').toISOString()
    },
    {
        id: '6',
        movementNumber: 'MOV-2025-006',
        type: 'exit',
        status: 'completed',
        date: new Date('2025-02-05').toISOString(),
        effectiveDate: new Date('2025-02-05').toISOString(),
        exitReason: 'maintenance_send',
        requestedById: 'user2',
        responsiblePerson: 'María García',
        notes: 'Envío a mantenimiento correctivo',
        tool: {
            id: '5',
            code: 'MAN-005',
            name: 'Manómetro Digital 0-1000 PSI'
        },
        items: [
            {
                id: 'item6',
                movementId: '6',
                toolId: '5',
                quantity: 1,
                notes: 'Requiere reparación'
            }
        ],
        createdAt: new Date('2025-02-05').toISOString(),
        updatedAt: new Date('2025-02-05').toISOString()
    },
    {
        id: '7',
        movementNumber: 'MOV-2025-007',
        type: 'entry',
        status: 'completed',
        date: new Date('2025-02-10').toISOString(),
        effectiveDate: new Date('2025-02-10').toISOString(),
        entryReason: 'calibration_return',
        requestedById: 'user3',
        responsiblePerson: 'Carlos Ruiz',
        supplier: 'Laboratorio ABC',
        notes: 'Retorno de calibración exitosa',
        tool: {
            id: '6',
            code: 'DUR-006',
            name: 'Durómetro Rockwell'
        },
        items: [
            {
                id: 'item7',
                movementId: '7',
                toolId: '6',
                quantity: 1,
                notes: 'Certificado incluido'
            }
        ],
        createdAt: new Date('2025-02-10').toISOString(),
        updatedAt: new Date('2025-02-10').toISOString()
    },
    {
        id: '8',
        movementNumber: 'MOV-2025-008',
        type: 'exit',
        status: 'cancelled',
        date: new Date('2025-02-12').toISOString(),
        exitReason: 'loan',
        requestedById: 'user4',
        responsiblePerson: 'Ana Martínez',
        recipient: 'Departamento de Calidad',
        notes: 'Cancelado: herramienta no disponible',
        tool: {
            id: '7',
            code: 'ESP-007',
            name: 'Espectrofotómetro UV-VIS'
        },
        items: [
            {
                id: 'item8',
                movementId: '8',
                toolId: '7',
                quantity: 1,
                notes: 'Movimiento cancelado'
            }
        ],
        createdAt: new Date('2025-02-12').toISOString(),
        updatedAt: new Date('2025-02-12').toISOString()
    },
    {
        id: '9',
        movementNumber: 'MOV-2025-009',
        type: 'entry',
        status: 'pending',
        date: new Date('2025-02-15').toISOString(),
        entryReason: 'donation',
        requestedById: 'user1',
        responsiblePerson: 'Juan Pérez',
        supplier: 'Donación Universidad',
        notes: 'Donación de equipo de laboratorio',
        tool: {
            id: '8',
            code: 'PH-008',
            name: 'pH-metro Digital'
        },
        items: [
            {
                id: 'item9',
                movementId: '9',
                toolId: '8',
                quantity: 3,
                notes: 'Pendiente de revisión'
            }
        ],
        createdAt: new Date('2025-02-15').toISOString(),
        updatedAt: new Date('2025-02-15').toISOString()
    },
    {
        id: '10',
        movementNumber: 'MOV-2025-010',
        type: 'exit',
        status: 'completed',
        date: new Date('2024-12-20').toISOString(),
        effectiveDate: new Date('2024-12-20').toISOString(),
        exitReason: 'decommission',
        requestedById: 'user2',
        responsiblePerson: 'María García',
        notes: 'Herramienta dada de baja por obsolescencia',
        tool: {
            id: '9',
            code: 'OLD-009',
            name: 'Equipo Obsoleto'
        },
        items: [
            {
                id: 'item10',
                movementId: '10',
                toolId: '9',
                quantity: 1,
                notes: 'Baja definitiva'
            }
        ],
        createdAt: new Date('2024-12-20').toISOString(),
        updatedAt: new Date('2024-12-20').toISOString()
    }
];

export const entries = movements.filter(m => m.type.startsWith('entry'));
export const exits = movements.filter(m => m.type.startsWith('exit'));
