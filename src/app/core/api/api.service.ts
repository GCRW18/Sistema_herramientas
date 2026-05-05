import { Injectable } from '@angular/core';
import PxpClient from 'pxp-client';
import {ErpLoadingService} from "@erp/services/loading";

@Injectable({
    providedIn: 'root'
})
export class ErpApiService {

    constructor(
        private _load: ErpLoadingService
    ) { }

    get(url: string): Promise<any> {
        return PxpClient.doRequest({ url, params: { start: 0, limit: 50 } }).then(
            (resp: any) => resp,
            () => null
        );
    }

    postRaw(url: string, params: any): Promise<any> {
        const req = (PxpClient as any).request({ url, params });
        if (!req) return Promise.resolve(null);
        return fetch(req).then(r => r.json(), () => null);
    }

    post(url: string, params: any, options: any = {}): Promise<any> {
        this._load._setLoadingStatus(true, url);
        return PxpClient.doRequest({ url, params, ...options }).then(
            (resp: any) => {
                this._load._setLoadingStatus(false, url);
                return resp;
            },
            (error: any) => {
                this._load._setLoadingStatus(false, url);
                console.warn('ERROR POST', error);
                let auth: any = localStorage.getItem('aut');
                try { if (auth !== null) auth = JSON.parse(auth); } catch { auth = null; }
                if (!auth) { location.reload(); }
                return null;
            }
        );
    }
}
