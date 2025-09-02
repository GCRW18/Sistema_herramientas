import { BooleanInput } from '@angular/cdk/coercion';
import { NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    OnDestroy,
    OnInit,
    forwardRef,
    inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ErpNavigationService } from '@erp/components/navigation/navigation.service';
import { ErpNavigationItem } from '@erp/components/navigation/navigation.types';
import { ErpVerticalNavigationBasicItemComponent } from '@erp/components/navigation/vertical/components/basic/basic.component';
import { ErpVerticalNavigationCollapsableItemComponent } from '@erp/components/navigation/vertical/components/collapsable/collapsable.component';
import { ErpVerticalNavigationDividerItemComponent } from '@erp/components/navigation/vertical/components/divider/divider.component';
import { ErpVerticalNavigationSpacerItemComponent } from '@erp/components/navigation/vertical/components/spacer/spacer.component';
import { ErpVerticalNavigationComponent } from '@erp/components/navigation/vertical/vertical.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'erp-vertical-navigation-group-item',
    templateUrl: './group.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass,
        MatIconModule,
        ErpVerticalNavigationBasicItemComponent,
        ErpVerticalNavigationCollapsableItemComponent,
        ErpVerticalNavigationDividerItemComponent,
        forwardRef(() => ErpVerticalNavigationGroupItemComponent),
        ErpVerticalNavigationSpacerItemComponent,
    ]
})
export class ErpVerticalNavigationGroupItemComponent
    implements OnInit, OnDestroy
{
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_autoCollapse: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    private _changeDetectorRef = inject(ChangeDetectorRef);
    private _erpNavigationService = inject(ErpNavigationService);

    @Input() autoCollapse: boolean;
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

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any {
        return item.id || index;
    }
}
