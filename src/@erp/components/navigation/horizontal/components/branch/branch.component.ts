import { BooleanInput } from '@angular/cdk/coercion';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    OnDestroy,
    OnInit,
    ViewChild,
    forwardRef,
    inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenu, MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ErpHorizontalNavigationBasicItemComponent } from '@erp/components/navigation/horizontal/components/basic/basic.component';
import { ErpHorizontalNavigationDividerItemComponent } from '@erp/components/navigation/horizontal/components/divider/divider.component';
import { ErpHorizontalNavigationComponent } from '@erp/components/navigation/horizontal/horizontal.component';
import { ErpNavigationService } from '@erp/components/navigation/navigation.service';
import { ErpNavigationItem } from '@erp/components/navigation/navigation.types';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'erp-horizontal-navigation-branch-item',
    templateUrl: './branch.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass,
        MatMenuModule,
        NgTemplateOutlet,
        ErpHorizontalNavigationBasicItemComponent,
        forwardRef(() => ErpHorizontalNavigationBranchItemComponent),
        ErpHorizontalNavigationDividerItemComponent,
        MatTooltipModule,
        MatIconModule,
    ]
})
export class ErpHorizontalNavigationBranchItemComponent
    implements OnInit, OnDestroy
{
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_child: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    private _changeDetectorRef = inject(ChangeDetectorRef);
    private _erpNavigationService = inject(ErpNavigationService);

    @Input() child: boolean = false;
    @Input() item: ErpNavigationItem;
    @Input() name: string;
    @ViewChild('matMenu', { static: true }) matMenu: MatMenu;

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

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Trigger the change detection
     */
    triggerChangeDetection(): void {
        // Mark for check
        this._changeDetectorRef.markForCheck();
    }

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
