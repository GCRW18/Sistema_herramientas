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

    get (url: string) {
        return PxpClient.doRequest({
            url: url,
            params: {
                start: 0,
                limit: 50,
            },
        });
    }

    post (url: string, params: any, options: any = {}) {
        this._load._setLoadingStatus(true, url);
        return PxpClient.doRequest({
            url: url,
            params: params,
            ...options,
        })
            .then( (resp) => {
                this._load._setLoadingStatus(false, url);
                return resp;
            })
            .catch(
                (error)=>{
                    this._load._setLoadingStatus(false, url);
                    console.warn('ERROR POST',error);
                    let auth:any = localStorage.getItem('aut');
                    if ( auth !== null)
                        auth = JSON.parse(auth);

                    // Reload the app
                    if ( !auth ) {
                        location.reload();
                    }

                    return error;
                }
            );
    }
}
