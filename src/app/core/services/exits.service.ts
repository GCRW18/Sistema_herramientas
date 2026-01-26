import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';
import { MovementService } from './movement.service';
import { ToolService } from './tool.service';

export interface PrestamoHerramientaData {
    // Datos del técnico
    nro_licencia: string;
    id_funcionario?: string;
    apellido_paterno?: string;
    apellido_materno?: string;
    nombres?: string;

    // Datos del préstamo
    fecha_prestamo: Date | string;
    fecha_retorno_esperada: Date | string;
    proyecto_tarea?: string;
    ubicacion_tecnico?: string;
    observaciones_generales?: string;

    // Items
    items: PrestamoItem[];
}

export interface PrestamoItem {
    codigo: string;
    id_herramienta?: string;
    descripcion?: string;
    serial?: string;
    cantidad: number;
    estado: string;
    observaciones?: string;
}

export interface EnvioBasesData {
    // Datos de origen
    base_origen: string;
    almacen_origen?: string;

    // Datos de destino
    base_destino: string;
    almacen_destino?: string;
    contacto_destino?: string;
    telefono_contacto?: string;

    // Datos del envío
    fecha_envio: Date | string;
    fecha_llegada_esperada?: Date | string;
    medio_transporte?: string;
    nro_guia?: string;
    transportista?: string;
    observaciones_generales?: string;

    // Items
    items: EnvioItem[];
}

export interface EnvioItem {
    codigo: string;
    id_herramienta?: string;
    descripcion?: string;
    serial?: string;
    cantidad: number;
    estado: string;
    observaciones?: string;
}

export interface EnvioCalibracionData {
    // Datos del proveedor
    proveedor: string;
    id_proveedor?: string;
    contacto?: string;
    telefono?: string;
    direccion?: string;

    // Datos del envío
    fecha_envio: Date | string;
    fecha_retorno_esperada?: Date | string;
    tipo_servicio: 'calibracion' | 'reparacion' | 'ambos';
    nro_orden_servicio?: string;
    costo_estimado?: number;
    observaciones_generales?: string;

    // Items
    items: CalibracionItem[];
}

export interface CalibracionItem {
    codigo: string;
    id_herramienta?: string;
    descripcion?: string;
    serial?: string;
    cantidad: number;
    motivo: string;
    estado_actual: string;
    observaciones?: string;
}

export interface CuarentenaData {
    // Datos de la cuarentena
    fecha_cuarentena: Date | string;
    motivo: string;
    tipo_no_conformidad?: string;
    acciones_correctivas?: string;
    responsable?: string;
    observaciones_generales?: string;

    // Items
    items: CuarentenaItem[];
}

export interface CuarentenaItem {
    codigo: string;
    id_herramienta?: string;
    descripcion?: string;
    serial?: string;
    cantidad: number;
    estado: string;
    detalle_problema: string;
    observaciones?: string;
}

export interface PrestamoTercerosData {
    // Datos del tercero
    empresa: string;
    id_empresa?: string;
    contacto: string;
    telefono?: string;
    email?: string;
    direccion?: string;

    // Datos del préstamo
    fecha_prestamo: Date | string;
    fecha_retorno_esperada: Date | string;
    motivo: string;
    nro_contrato?: string;
    costo_prestamo?: number;
    observaciones_generales?: string;

    // Items
    items: PrestamoTercerosItem[];
}

export interface PrestamoTercerosItem {
    codigo: string;
    id_herramienta?: string;
    descripcion?: string;
    serial?: string;
    cantidad: number;
    estado: string;
    valor_estimado?: number;
    observaciones?: string;
}

export interface TraspasoDepartamentoData {
    // Datos de origen y destino
    departamento_origen: string;
    id_depto_origen?: string;
    departamento_destino: string;
    id_depto_destino?: string;

    // Datos del traspaso
    fecha_traspaso: Date | string;
    motivo: string;
    responsable_origen?: string;
    responsable_destino?: string;
    aprobado_por?: string;
    observaciones_generales?: string;

    // Items
    items: TraspasoItem[];
}

export interface TraspasoItem {
    codigo: string;
    id_herramienta?: string;
    descripcion?: string;
    serial?: string;
    cantidad: number;
    estado: string;
    observaciones?: string;
}

export interface BajaHerramientaData {
    // Datos de la baja
    fecha_baja: Date | string;
    motivo: string;
    tipo_baja: 'obsolescencia' | 'daño_irreparable' | 'perdida' | 'robo' | 'otro';
    responsable?: string;
    aprobado_por?: string;
    nro_acta?: string;
    observaciones_generales?: string;

    // Items
    items: BajaItem[];
}

export interface BajaItem {
    codigo: string;
    id_herramienta?: string;
    descripcion?: string;
    serial?: string;
    cantidad: number;
    estado: string;
    valor_libro?: number;
    detalle_baja: string;
    observaciones?: string;
}

@Injectable({ providedIn: 'root' })
export class ExitsService {
    private _api = inject(ErpApiService);
    private _movementService = inject(MovementService);
    private _toolService = inject(ToolService);

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Préstamo de Herramientas
    // -----------------------------------------------------------------------------------------------------

    /**
     * Buscar técnico por número de licencia
     */
    buscarTecnico(nroLicencia: string): Observable<any> {
        return from(this._api.post('herramientas/funcionarios/getFuncionarioByLicencia', {
            nro_licencia: nroLicencia
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || null);
            })
        );
    }

    /**
     * Crear préstamo de herramienta
     */
    crearPrestamoHerramienta(data: PrestamoHerramientaData): Observable<any> {
        return from(this._api.post('herramientas/salidas/insertPrestamoHerramienta', {
            ...data,
            tipo_movimiento: 'prestamo_herramienta'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Buscar préstamos activos de un técnico
     */
    getPrestamosActivosTecnico(idFuncionario: string): Observable<any[]> {
        return from(this._api.post('herramientas/salidas/listPrestamosActivos', {
            id_funcionario: idFuncionario
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Envío a Bases
    // -----------------------------------------------------------------------------------------------------

    /**
     * Obtener lista de bases disponibles
     */
    getBasesList(): Observable<any[]> {
        return from(this._api.post('herramientas/bases/listBases', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Crear envío a bases
     */
    crearEnvioBases(data: EnvioBasesData): Observable<any> {
        return from(this._api.post('herramientas/salidas/insertEnvioBases', {
            ...data,
            tipo_movimiento: 'envio_bases'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Buscar envíos pendientes a una base
     */
    getEnviosPendientesBase(baseDestino: string): Observable<any[]> {
        return from(this._api.post('herramientas/salidas/listEnviosPendientes', {
            base_destino: baseDestino
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Envío a Calibración
    // -----------------------------------------------------------------------------------------------------

    /**
     * Obtener lista de proveedores de calibración
     */
    getProveedoresCalibracion(): Observable<any[]> {
        return from(this._api.post('herramientas/proveedores/listProveedores', {
            tipo_servicio: 'calibracion'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Crear envío a calibración
     */
    crearEnvioCalibracion(data: EnvioCalibracionData): Observable<any> {
        return from(this._api.post('herramientas/salidas/insertEnvioCalibracion', {
            ...data,
            tipo_movimiento: 'envio_calibracion'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Buscar herramientas con calibración vencida
     */
    getHerramientasCalibracionVencida(): Observable<any[]> {
        return this._toolService.getToolsWithExpiredCalibration();
    }

    /**
     * Buscar herramientas que requieren calibración pronto
     */
    getHerramientasRequierenCalibracion(): Observable<any[]> {
        return this._toolService.getToolsRequiringCalibration();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Cuarentena
    // -----------------------------------------------------------------------------------------------------

    /**
     * Crear registro de cuarentena
     */
    crearCuarentena(data: CuarentenaData): Observable<any> {
        return from(this._api.post('herramientas/salidas/insertCuarentena', {
            ...data,
            tipo_movimiento: 'cuarentena'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Obtener herramientas en cuarentena
     */
    getHerramientasEnCuarentena(): Observable<any[]> {
        return from(this._api.post('herramientas/salidas/listHerramientasCuarentena', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Liberar herramienta de cuarentena
     */
    liberarDeCuarentena(idHerramienta: string, observaciones?: string): Observable<any> {
        return from(this._api.post('herramientas/salidas/liberarCuarentena', {
            id_herramienta: idHerramienta,
            observaciones: observaciones
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Préstamo a Terceros
    // -----------------------------------------------------------------------------------------------------

    /**
     * Buscar empresas terceras
     */
    getEmpresasTerceros(): Observable<any[]> {
        return from(this._api.post('herramientas/empresas/listEmpresas', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Crear préstamo a terceros
     */
    crearPrestamoTerceros(data: PrestamoTercerosData): Observable<any> {
        return from(this._api.post('herramientas/salidas/insertPrestamoTerceros', {
            ...data,
            tipo_movimiento: 'prestamo_terceros'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Buscar préstamos activos a terceros
     */
    getPrestamosActivosTerceros(): Observable<any[]> {
        return from(this._api.post('herramientas/salidas/listPrestamosActivosTerceros', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Traspaso entre Departamentos
    // -----------------------------------------------------------------------------------------------------

    /**
     * Obtener lista de departamentos
     */
    getDepartamentos(): Observable<any[]> {
        return from(this._api.post('herramientas/departamentos/listDepartamentos', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Crear traspaso entre departamentos
     */
    crearTraspasoDepartamento(data: TraspasoDepartamentoData): Observable<any> {
        return from(this._api.post('herramientas/salidas/insertTraspasoDepartamento', {
            ...data,
            tipo_movimiento: 'traspaso_departamento'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Buscar traspasos pendientes de aprobación
     */
    getTraspasosPendientesAprobacion(): Observable<any[]> {
        return from(this._api.post('herramientas/salidas/listTraspasosPendientes', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Baja de Herramienta
    // -----------------------------------------------------------------------------------------------------

    /**
     * Crear baja de herramienta
     */
    crearBajaHerramienta(data: BajaHerramientaData): Observable<any> {
        return from(this._api.post('herramientas/salidas/insertBajaHerramienta', {
            ...data,
            tipo_movimiento: 'baja'
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Buscar herramientas candidatas para baja
     */
    getHerramientasCandidatasBaja(): Observable<any[]> {
        return from(this._api.post('herramientas/salidas/listHerramientasCandidatasBaja', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Buscar bajas pendientes de aprobación
     */
    getBajasPendientesAprobacion(): Observable<any[]> {
        return from(this._api.post('herramientas/salidas/listBajasPendientes', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Comunes
    // -----------------------------------------------------------------------------------------------------

    /**
     * Buscar herramienta por código (común para todos los módulos)
     */
    buscarHerramientaPorCodigo(codigo: string): Observable<any> {
        return this._toolService.getToolByCode(codigo);
    }

    /**
     * Validar disponibilidad de herramienta para salida
     */
    validarDisponibilidad(codigo: string): Observable<any> {
        return from(this._api.post('herramientas/salidas/validarDisponibilidad', {
            codigo: codigo
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos?.[0] || { disponible: false });
            })
        );
    }

    /**
     * Generar comprobante de salida
     */
    generarComprobanteSalida(idMovimiento: string): Observable<any> {
        return from(this._api.post('herramientas/salidas/generarComprobante', {
            id_movimiento: idMovimiento
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }
}
