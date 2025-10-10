import { Injectable } from '@angular/core';
import { ErpApiService } from '../../../core/api/api.service';
import { from, Observable, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

    constructor(
        private _api: ErpApiService
    ) { }

    getTool(): Observable <any[]>{
        return from(this._api.post(
            'herramientas/Herramienta/listarHerramienta',
            {start:0,limit:50,sort:'nombre',dir:'asc',query:''}
        )).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }
}
