import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    OnDestroy,
    OnInit,
    inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    IsActiveMatchOptions,
    RouterLink,
    RouterLinkActive,
} from '@angular/router';
import { ErpHorizontalNavigationComponent } from '@erp/components/navigation/horizontal/horizontal.component';
import { ErpNavigationService } from '@erp/components/navigation/navigation.service';
import { ErpNavigationItem } from '@erp/components/navigation/navigation.types';
import { ErpUtilsService } from '@erp/services/utils/utils.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'erp-horizontal-navigation-basic-item',
    templateUrl: './basic.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass,
        RouterLink,
        RouterLinkActive,
        MatTooltipModule,
        NgTemplateOutlet,
        MatMenuModule,
        MatIconModule,
    ]
})
export class ErpHorizontalNavigationBasicItemComponent
    implements OnInit, OnDestroy
{
    private _changeDetectorRef = inject(ChangeDetectorRef);
    private _erpNavigationService = inject(ErpNavigationService);
    private _erpUtilsService = inject(ErpUtilsService);

    @Input() item: ErpNavigationItem;
    @Input() name: string;

    // Set the equivalent of {exact: false} as default for active match options.
    // We are not assigning the item.isActiveMatchOptions directly to the
    // [routerLinkActiveOptions] because if it's "undefined" initially, the router
    // will throw an error and stop working.
    isActiveMatchOptions: IsActiveMatchOptions =
        this._erpUtilsService.subsetMatchOptions;

    private _erpHorizontalNavigationComponent: ErpHorizontalNavigationComponent;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Set the "isActiveMatchOptions" either from item's
        // "isActiveMatchOptions" or the equivalent form of
        // item's "exactMatch" option
        this.isActiveMatchOptions =
            this.item.isActiveMatchOptions ?? this.item.exactMatch
                ? this._erpUtilsService.exactMatchOptions
                : this._erpUtilsService.subsetMatchOptions;

        // Get the parent navigation component
        this._erpHorizontalNavigationComponent =
            this._erpNavigationService.getComponent(this.name);

        // Mark for check
        this._changeDetectorRef.markForCheck();

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
