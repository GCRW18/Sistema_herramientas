// Audit Log Types
export interface AuditLog {
    id: string;
    timestamp: Date;
    user: string;
    userId?: string;
    action: string;
    actionType: 'create' | 'update' | 'delete' | 'view' | 'export' | 'import' | 'login' | 'logout';
    module: string;
    entity: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
    userAgent?: string;
    previousValue?: any;
    newValue?: any;
}

export interface AuditLogFilters {
    search?: string;
    actionType?: string;
    module?: string;
    startDate?: Date | string;
    endDate?: Date | string;
    user?: string;
    entityType?: string;
}

// Barcode Types
export type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'QR' | 'DATAMATRIX' | 'PDF417';

export interface BarcodeGenerationOptions {
    format: BarcodeFormat;
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    textAlign?: 'left' | 'center' | 'right';
    textPosition?: 'top' | 'bottom';
    background?: string;
    lineColor?: string;
    margin?: number;
}

export interface BarcodeRequest {
    toolIds: string[];
    format: BarcodeFormat;
    includeDetails?: boolean;
    paperSize?: 'A4' | 'Letter' | 'Label';
    options?: BarcodeGenerationOptions;
}

export interface BarcodeResponse {
    success: boolean;
    fileUrl?: string;
    fileName?: string;
    barcodes?: GeneratedBarcode[];
    error?: string;
}

export interface GeneratedBarcode {
    toolId: string;
    toolCode: string;
    toolName: string;
    barcodeData: string; // Base64 encoded image or SVG
    format: BarcodeFormat;
}

// Label Types
export type LabelTemplate = 'standard' | 'detailed' | 'compact' | 'qr';
export type LabelSize = 'small' | 'medium' | 'large';

export interface LabelGenerationOptions {
    template: LabelTemplate;
    size: LabelSize;
    includeBarcode?: boolean;
    includeQR?: boolean;
    includeCompanyLogo?: boolean;
    paperSize?: 'A4' | 'Letter' | 'Label';
    labelsPerRow?: number;
    margin?: number;
}

export interface LabelRequest {
    toolIds: string[];
    options: LabelGenerationOptions;
}

export interface LabelResponse {
    success: boolean;
    fileUrl?: string;
    fileName?: string;
    labels?: GeneratedLabel[];
    error?: string;
}

export interface GeneratedLabel {
    toolId: string;
    toolCode: string;
    toolName: string;
    category?: string;
    location?: string;
    status?: string;
    labelData: string; // Base64 encoded PDF or image
}

// Export/Print Types
export interface PrintOptions {
    orientation?: 'portrait' | 'landscape';
    paperSize?: 'A4' | 'Letter' | 'Label';
    copies?: number;
    colorMode?: 'color' | 'grayscale';
}

export interface ExportOptions {
    format?: 'PDF' | 'PNG' | 'SVG' | 'EXCEL';
    quality?: 'low' | 'medium' | 'high';
    includeMetadata?: boolean;
}
