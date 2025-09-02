import { NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    inject,
    Input,
    OnDestroy,
    OnInit,
} from '@angular/core';
import { ErpNavigationService } from '@erp/components/navigation/navigation.service';
import { ErpNavigationItem } from '@erp/components/navigation/navigation.types';
import { ErpVerticalNavigationComponent } from '@erp/components/navigation/vertical/vertical.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'erp-vertical-navigation-spacer-item',
    templateUrl: './spacer.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgClass]
})
export class ErpVerticalNavigationSpacerItemComponent
    implements OnInit, OnDestroy
{
    private _changeDetectorRef = inject(ChangeDetectorRef);
    private _erpNavigationService = inject(ErpNavigationService);

    @Input() item: ErpNavigationItem;
    @Input() name: string;

    private _erpVerticalNavigationComponent: ErpVerticalNavigationComponent;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Get the parent navigation component
        this._erpVerticalNavigationComponent =
            this._erpNavigationService.getComponent(this.name);

        // Subscribe to onRefreshed on the navigation component
        this._erpVerticalNavigationComponent.onRefreshed
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                // Mark for check
                this._changeDetectorRef.markForCheck();
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
}
