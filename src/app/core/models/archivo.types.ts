export interface Archivo {
    id_archivo: string;
    id_herramienta: string;
    tipo: 'image' | 'document';
    nombre_archivo: string;
    ruta: string;
    tamano_bytes?: number;
    mime_type?: string;
    descripcion?: string;
    estado_reg: string;
    id_usuario_reg: string;
    fecha_reg: string;
    id_usuario_ai?: string;
    usuario_ai?: string;
    id_usuario_mod?: string;
    fecha_mod?: string;
    usr_reg?: string;
    usr_mod?: string;
}
