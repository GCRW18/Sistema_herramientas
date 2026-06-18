import { Injectable, inject } from '@angular/core';
import { from, Observable, of, switchMap } from 'rxjs';
import { ErpApiService } from '../api/api.service';

export interface AlertRecipient {
    id_destinatario: number;
    nombre: string;
    email: string;
    dias_alerta: number;
    notes: string;
    activo: boolean;
}

@Injectable({ providedIn: 'root' })
export class AlertRecipientsService {
    private _api = inject(ErpApiService);

    getRecipients(filters?: { search?: string; activo?: boolean }): Observable<AlertRecipient[]> {
        const params: any = { start: 0, limit: 100, sort: 'nombre', dir: 'asc' };
        const extra: string[] = [];
        if (filters?.search) {
            const s = filters.search.replace(/'/g, "''");
            extra.push(`(LOWER(nombre) LIKE LOWER('%${s}%') OR LOWER(email) LIKE LOWER('%${s}%'))`);
        }
        if (filters?.activo !== undefined) extra.push(`activo = ${filters.activo}`);
        if (extra.length) params.filtro_adicional = extra.join(' AND ');

        return from(this._api.post('herramientas/alertadestinatarios/listarAlertaDestinatarios', params)).pipe(
            switchMap((response: any) => {
                const raw: any[] = response?.datos || response?.data || [];
                return of(raw.map((r: any) => ({
                    ...r,
                    activo: r.activo === true || r.activo === 't' || r.activo === 'true'
                })));
            })
        );
    }

    createRecipient(data: Partial<AlertRecipient>): Observable<any> {
        return from(this._api.post('herramientas/alertadestinatarios/insertarAlertaDestinatarios', data)).pipe(
            switchMap((response: any) => of(response?.data || {}))
        );
    }

    updateRecipient(id: number, data: Partial<AlertRecipient>): Observable<any> {
        return from(this._api.post('herramientas/alertadestinatarios/modificarAlertaDestinatarios', { ...data, id_destinatario: id })).pipe(
            switchMap((response: any) => of(response?.data || {}))
        );
    }

    deleteRecipient(id: number): Observable<void> {
        return from(this._api.post('herramientas/alertadestinatarios/eliminarAlertaDestinatarios', { id_destinatario: id })).pipe(
            switchMap(() => of(undefined))
        );
    }
}
