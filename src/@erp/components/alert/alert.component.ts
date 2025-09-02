import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';

import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    HostBinding,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    SimpleChanges,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { erpAnimations } from '@erp/animations';
import { ErpAlertService } from '@erp/components/alert/alert.service';
import {
    ErpAlertAppearance,
    ErpAlertType,
} from '@erp/components/alert/alert.types';
import { ErpUtilsService } from '@erp/services/utils/utils.service';
import { Subject, filter, takeUntil } from 'rxjs';

@Component({
    selector: 'erp-alert',
    templateUrl: './alert.component.html',
    styleUrls: ['./alert.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: erpAnimations,
    exportAs: 'erpAlert',
    imports: [MatIconModule, MatButtonModule]
})
export class ErpAlertComponent implements OnChanges, OnInit, OnDestroy {
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_dismissible: BooleanInput;
    static ngAcceptInputType_dismissed: BooleanInput;
    static ngAcceptInputType_showIcon: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    private _changeDetectorRef = inject(ChangeDetectorRef);
    private _erpAlertService = inject(ErpAlertService);
    private _erpUtilsService = inject(ErpUtilsService);

    @Input() appearance: ErpAlertAppearance = 'soft';
    @Input() dismissed: boolean = false;
    @Input() dismissible: boolean = false;
    @Input() name: string = this._erpUtilsService.randomId();
    @Input() showIcon: boolean = true;
    @Input() type: ErpAlertType = 'primary';
    @Output() readonly dismissedChanged: EventEmitter<boolean> =
        new EventEmitter<boolean>();

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Host binding for component classes
     */
    @HostBinding('class') get classList(): any {
        /* eslint-disable @typescript-eslint/naming-convention */
        return {
            'erp-alert-appearance-border': this.appearance === 'border',
            'erp-alert-appearance-fill': this.appearance === 'fill',
            'erp-alert-appearance-outline': this.appearance === 'outline',
            'erp-alert-appearance-soft': this.appearance === 'soft',
            'erp-alert-dismissed': this.dismissed,
            'erp-alert-dismissible': this.dismissible,
            'erp-alert-show-icon': this.showIcon,
            'erp-alert-type-primary': this.type === 'primary',
            'erp-alert-type-accent': this.type === 'accent',
            'erp-alert-type-warn': this.type === 'warn',
            'erp-alert-type-basic': this.type === 'basic',
            'erp-alert-type-info': this.type === 'info',
            'erp-alert-type-success': this.type === 'success',
            'erp-alert-type-warning': this.type === 'warning',
            'erp-alert-type-error': this.type === 'error',
        };
        /* eslint-enable @typescript-eslint/naming-convention */
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On changes
     *
     * @param changes
     */
    ngOnChanges(changes: SimpleChanges): void {
        // Dismissed
        if ('dismissed' in changes) {
            // Coerce the value to a boolean
            this.dismissed = coerceBooleanProperty(
                changes.dismissed.currentValue
            );

            // Dismiss/show the alert
            this._toggleDismiss(this.dismissed);
        }

        // Dismissible
        if ('dismissible' in changes) {
            // Coerce the value to a boolean
            this.dismissible = coerceBooleanProperty(
                changes.dismissible.currentValue
            );
        }

        // Show icon
        if ('showIcon' in changes) {
            // Coerce the value to a boolean
            this.showIcon = coerceBooleanProperty(
                changes.showIcon.currentValue
            );
        }
    }

    /**
     * On init
     */
    ngOnInit(): void {
        // Subscribe to the dismiss calls
        this._erpAlertService.onDismiss
            .pipe(
                filter((name) => this.name === name),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(() => {
                // Dismiss the alert
                this.dismiss();
            });

        // Subscribe to the show calls
        this._erpAlertService.onShow
            .pipe(
                filter((name) => this.name === name),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(() => {
                // Show the alert
                this.show();
            });
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Dismiss the alert
     */
    dismiss(): void {
        // Return if the alert is already dismissed
        if (this.dismissed) {
            return;
        }

        // Dismiss the alert
        this._toggleDismiss(true);
    }

    /**
     * Show the dismissed alert
     */
    show(): void {
        // Return if the alert is already showing
        if (!this.dismissed) {
            return;
        }

        // Show the alert
        this._toggleDismiss(false);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Dismiss/show the alert
     *
     * @param dismissed
     * @private
     */
    private _toggleDismiss(dismissed: boolean): void {
        // Return if the alert is not dismissible
        if (!this.dismissible) {
            return;
        }

        // Set the dismissed
        this.dismissed = dismissed;

        // Execute the observable
        this.dismissedChanged.next(this.dismissed);

        // Notify the change detector
        this._changeDetectorRef.markForCheck();
    }
}
