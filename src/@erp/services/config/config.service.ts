import { inject, Injectable } from '@angular/core';
import { ERP_CONFIG } from '@erp/services/config/config.constants';
import { merge } from 'lodash-es';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ErpConfigService {
    private _config = new BehaviorSubject(inject(ERP_CONFIG));

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Setter & getter for config
     */
    set config(value: any) {
        // Merge the new config over to the current config
        const config = merge({}, this._config.getValue(), value);

        // Execute the observable
        this._config.next(config);
    }

    // eslint-disable-next-line @typescript-eslint/member-ordering
    get config$(): Observable<any> {
        return this._config.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Resets the config to the default
     */
    reset(): void {
        // Set the config
        this._config.next(this.config);
    }
}
