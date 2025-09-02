import { Component } from '@angular/core';
import { ErpConfig, ErpConfigService, Scheme } from '../../../../@erp/services/config';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'scheme',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './scheme.component.html'
})
export class SchemeComponent {

    config: ErpConfig;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(private _erpConfigService: ErpConfigService) {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Subscribe to config changes
        this._erpConfigService.config$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((config: ErpConfig) => {
                // Store the config
                this.config = config;
            });
    }

    /**
     * Set the scheme on the config
     *
     * @param scheme
     */
    setScheme(scheme: Scheme): void {
        this._erpConfigService.config = { scheme };
    }
}
