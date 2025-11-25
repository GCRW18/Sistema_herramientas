export interface Archivo {
    id_file: string;
    tool_id: string;
    type: 'image' | 'document';
    file_name: string;
    path: string;
    size_bytes?: number;
    mime_type?: string;
    description?: string;
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
