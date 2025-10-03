export const kits = [
    {
        id: '1',
        code: 'KIT-001',
        name: 'Kit de Calibración Básico',
        description: 'Kit básico para calibración de herramientas de medición dimensional',
        categoryId: '1',
        categoryName: 'Metrología',
        status: 'available',
        requiresCalibration: true,
        lastCalibrationDate: new Date('2024-06-01').toISOString(),
        nextCalibrationDate: new Date('2025-06-01').toISOString(),
        active: true,
        items: [
            {
                id: '1',
                kitId: '1',
                toolId: '1',
                tool: {
                    id: '1',
                    code: 'MIC-001',
                    name: 'Micrómetro Digital 0-25mm'
                },
                quantity: 1,
                required: true
            },
            {
                id: '2',
                kitId: '1',
                toolId: '2',
                tool: {
                    id: '2',
                    code: 'CAL-002',
                    name: 'Calibrador Vernier 300mm'
                },
                quantity: 1,
                required: true
            },
            {
                id: '3',
                kitId: '1',
                toolId: '3',
                tool: {
                    id: '3',
                    code: 'BAL-003',
                    name: 'Balanza Analítica 0.1mg'
                },
                quantity: 1,
                required: false
            }
        ],
        notes: 'Kit de uso frecuente para calibración dimensional',
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date('2024-01-01').toISOString()
    },
    {
        id: '2',
        code: 'KIT-002',
        name: 'Kit de Medición de Temperatura',
        description: 'Kit completo para medición y verificación de temperatura',
        categoryId: '2',
        categoryName: 'Temperatura',
        status: 'incomplete',
        requiresCalibration: true,
        lastCalibrationDate: new Date('2024-08-15').toISOString(),
        nextCalibrationDate: new Date('2025-02-15').toISOString(),
        active: true,
        items: [
            {
                id: '4',
                kitId: '2',
                toolId: '4',
                tool: {
                    id: '4',
                    code: 'TERM-004',
                    name: 'Termómetro Digital -50/150°C'
                },
                quantity: 2,
                required: true
            }
        ],
        notes: 'Falta agregar termocupla tipo K',
        createdAt: new Date('2024-02-01').toISOString(),
        updatedAt: new Date('2024-02-01').toISOString()
    },
    {
        id: '3',
        code: 'KIT-003',
        name: 'Kit de Inspección Visual',
        description: 'Herramientas para inspección visual y verificación de acabados',
        categoryId: '3',
        categoryName: 'Inspección',
        status: 'available',
        requiresCalibration: false,
        active: true,
        items: [
            {
                id: '5',
                kitId: '3',
                toolId: '5',
                tool: {
                    id: '5',
                    code: 'MAN-005',
                    name: 'Manómetro Digital 0-1000 PSI'
                },
                quantity: 1,
                required: true
            },
            {
                id: '6',
                kitId: '3',
                toolId: '6',
                tool: {
                    id: '6',
                    code: 'DUR-006',
                    name: 'Durómetro Rockwell'
                },
                quantity: 2,
                required: false
            }
        ],
        notes: 'Kit completo y operativo',
        createdAt: new Date('2024-03-01').toISOString(),
        updatedAt: new Date('2024-03-01').toISOString()
    },
    {
        id: '4',
        code: 'KIT-004',
        name: 'Kit de Análisis Químico',
        description: 'Equipos para análisis químico y control de calidad',
        categoryId: '4',
        categoryName: 'Química',
        status: 'in_use',
        requiresCalibration: true,
        lastCalibrationDate: new Date('2024-09-01').toISOString(),
        nextCalibrationDate: new Date('2025-03-01').toISOString(),
        active: true,
        items: [
            {
                id: '7',
                kitId: '4',
                toolId: '7',
                tool: {
                    id: '7',
                    code: 'ESP-007',
                    name: 'Espectrofotómetro UV-VIS'
                },
                quantity: 1,
                required: true
            },
            {
                id: '8',
                kitId: '4',
                toolId: '8',
                tool: {
                    id: '8',
                    code: 'PH-008',
                    name: 'pH-metro Digital'
                },
                quantity: 1,
                required: true
            }
        ],
        notes: 'En uso por laboratorio de control de calidad',
        createdAt: new Date('2024-04-01').toISOString(),
        updatedAt: new Date('2024-10-15').toISOString()
    },
    {
        id: '5',
        code: 'KIT-005',
        name: 'Kit de Calibración Avanzado',
        description: 'Kit avanzado con herramientas de alta precisión',
        categoryId: '1',
        categoryName: 'Metrología',
        status: 'in_calibration',
        requiresCalibration: true,
        lastCalibrationDate: new Date('2024-11-01').toISOString(),
        nextCalibrationDate: new Date('2025-01-05').toISOString(),
        active: true,
        items: [
            {
                id: '9',
                kitId: '5',
                toolId: '1',
                tool: {
                    id: '1',
                    code: 'MIC-001',
                    name: 'Micrómetro Digital 0-25mm'
                },
                quantity: 2,
                required: true
            },
            {
                id: '10',
                kitId: '5',
                toolId: '2',
                tool: {
                    id: '2',
                    code: 'CAL-002',
                    name: 'Calibrador Vernier 300mm'
                },
                quantity: 2,
                required: true
            },
            {
                id: '11',
                kitId: '5',
                toolId: '3',
                tool: {
                    id: '3',
                    code: 'BAL-003',
                    name: 'Balanza Analítica 0.1mg'
                },
                quantity: 1,
                required: true
            }
        ],
        notes: 'Kit en proceso de calibración anual - próximo vencimiento',
        createdAt: new Date('2024-05-01').toISOString(),
        updatedAt: new Date('2024-11-20').toISOString()
    },
    {
        id: '6',
        code: 'KIT-006',
        name: 'Kit de Medición Eléctrica',
        description: 'Instrumentos para mediciones eléctricas y electrónicas',
        categoryId: '5',
        categoryName: 'Eléctrica',
        status: 'available',
        requiresCalibration: true,
        lastCalibrationDate: new Date('2024-07-01').toISOString(),
        nextCalibrationDate: new Date('2025-07-01').toISOString(),
        active: true,
        items: [
            {
                id: '12',
                kitId: '6',
                toolId: '9',
                tool: {
                    id: '9',
                    code: 'MULT-009',
                    name: 'Multímetro Digital'
                },
                quantity: 2,
                required: true
            },
            {
                id: '13',
                kitId: '6',
                toolId: '10',
                tool: {
                    id: '10',
                    code: 'OSC-010',
                    name: 'Osciloscopio Digital'
                },
                quantity: 1,
                required: true
            }
        ],
        notes: 'Kit para mantenimiento eléctrico',
        createdAt: new Date('2024-06-01').toISOString(),
        updatedAt: new Date('2024-06-01').toISOString()
    },
    {
        id: '7',
        code: 'KIT-007',
        name: 'Kit de Mantenimiento Preventivo',
        description: 'Herramientas básicas para mantenimiento preventivo',
        categoryId: '6',
        categoryName: 'Mantenimiento',
        status: 'available',
        requiresCalibration: false,
        active: true,
        items: [
            {
                id: '14',
                kitId: '7',
                toolId: '11',
                tool: {
                    id: '11',
                    code: 'TOOL-011',
                    name: 'Juego de Llaves Allen'
                },
                quantity: 1,
                required: true
            },
            {
                id: '15',
                kitId: '7',
                toolId: '12',
                tool: {
                    id: '12',
                    code: 'TOOL-012',
                    name: 'Torquímetro Digital'
                },
                quantity: 1,
                required: false
            }
        ],
        notes: 'Kit de uso general - no requiere calibración',
        createdAt: new Date('2024-07-01').toISOString(),
        updatedAt: new Date('2024-07-01').toISOString()
    },
    {
        id: '8',
        code: 'KIT-008',
        name: 'Kit de Presión y Vacío',
        description: 'Instrumentos para medición de presión y vacío',
        categoryId: '2',
        categoryName: 'Presión',
        status: 'in_maintenance',
        requiresCalibration: true,
        lastCalibrationDate: new Date('2024-10-01').toISOString(),
        nextCalibrationDate: new Date('2025-04-01').toISOString(),
        active: true,
        items: [
            {
                id: '16',
                kitId: '8',
                toolId: '5',
                tool: {
                    id: '5',
                    code: 'MAN-005',
                    name: 'Manómetro Digital 0-1000 PSI'
                },
                quantity: 2,
                required: true
            }
        ],
        notes: 'En mantenimiento correctivo - sensor dañado',
        createdAt: new Date('2024-08-01').toISOString(),
        updatedAt: new Date('2024-12-01').toISOString()
    }
];
