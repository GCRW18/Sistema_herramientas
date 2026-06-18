import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';

export interface ParametrosConfig {
    dias_alerta_calibracion:       number;
    intervalo_calibracion_defecto: number;
    dias_max_prestamo:             number;
    dias_alerta_vencimiento:       number;
    stock_minimo_defecto:          number;
    permitir_stock_negativo:       boolean;
    validar_calibracion_prestamo:  boolean;
    requiere_aprobacion_externo:   boolean;
}

interface ParamMeta { tipo: string; cat: string; }
type ConfigKey = keyof ParametrosConfig;

@Injectable({ providedIn: 'root' })
export class ParametrosService {
    private _api = inject(ErpApiService);
    private _rawParams: any[] = [];

    private readonly PARAM_META: Record<ConfigKey, ParamMeta> = {
        dias_alerta_calibracion:       { tipo: 'int4', cat: 'calibracion' },
        intervalo_calibracion_defecto: { tipo: 'int4', cat: 'calibracion' },
        dias_max_prestamo:             { tipo: 'int4', cat: 'prestamos'   },
        dias_alerta_vencimiento:       { tipo: 'int4', cat: 'prestamos'   },
        stock_minimo_defecto:          { tipo: 'int4', cat: 'inventario'  },
        permitir_stock_negativo:       { tipo: 'bool', cat: 'inventario'  },
        validar_calibracion_prestamo:  { tipo: 'bool', cat: 'inventario'  },
        requiere_aprobacion_externo:   { tipo: 'bool', cat: 'prestamos'   },
    };

    private readonly DEFAULTS: ParametrosConfig = {
        dias_alerta_calibracion:       30,
        intervalo_calibracion_defecto: 365,
        dias_max_prestamo:             15,
        dias_alerta_vencimiento:       3,
        stock_minimo_defecto:          5,
        permitir_stock_negativo:       false,
        validar_calibracion_prestamo:  true,
        requiere_aprobacion_externo:   true,
    };

    getParametros(): Observable<ParametrosConfig> {
        return from(this._api.post('herramientas/parametros/listarParametros', { start: 0, limit: 50 })).pipe(
            switchMap((response: any) => {
                const raw: any[] = response?.datos || response?.data || [];
                this._rawParams = raw;

                const find = (nombre: string, def: any, tipo: string) => {
                    const row = raw.find(r => r.nombre === nombre);
                    if (!row) return def;
                    const v = row.valor;
                    if (tipo === 'bool') return v === 'true' || v === 't' || v === true;
                    if (tipo === 'int4') return Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : def;
                    return v ?? def;
                };

                const config: ParametrosConfig = {} as ParametrosConfig;
                (Object.keys(this.PARAM_META) as ConfigKey[]).forEach(k => {
                    const meta = this.PARAM_META[k];
                    (config as any)[k] = find(k, (this.DEFAULTS as any)[k], meta.tipo);
                });
                return of(config);
            })
        );
    }

    saveParametros(config: ParametrosConfig): Observable<any> {
        const keys = Object.keys(this.PARAM_META) as ConfigKey[];
        const requests = keys.map(k => {
            const existing = this._rawParams.find(r => r.nombre === k);
            const meta     = this.PARAM_META[k];
            const valor    = String((config as any)[k]);
            const payload: any = {
                nombre:      k,
                valor,
                tipo_dato:   meta.tipo,
                categoria:   meta.cat,
                editable:    true,
                description: k,
            };
            if (existing?.id_parametro) payload.id_parametro = existing.id_parametro;
            return from(this._api.post('herramientas/parametros/insertarParametros', payload));
        });

        return requests.reduce(
            (acc$, curr$) => acc$.pipe(switchMap(() => curr$)),
            of(null) as Observable<any>
        );
    }
}
