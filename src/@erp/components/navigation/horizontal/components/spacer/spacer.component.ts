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
import { ErpHorizontalNavigationComponent } from '@erp/components/navigation/horizontal/horizontal.component';
import { ErpNavigationService } from '@erp/components/navigation/navigation.service';
import { ErpNavigationItem } from '@erp/components/navigation/navigation.types';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'erp-horizontal-navigation-spacer-item',
    templateUrl: './spacer.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgClass]
})
export class ErpHorizontalNavigationSpacerItemComponent
    implements OnInit, OnDestroy
{
    private _changeDetectorRef = inject(ChangeDetectorRef);
    private _erpNavigationService = inject(ErpNavigationService);

    @Input() item: ErpNavigationItem;
    @Input() name: string;

    private _erpHorizontalNavigationComponent: ErpHorizontalNavigationComponent;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Get the parent navigation component
        this._erpHorizontalNavigationComponent =
            this._erpNavigationService.getComponent(this.name);

        // Subscribe to onRefreshed on the navigation component
        this._erpHorizontalNavigationComponent.onRefreshed
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
