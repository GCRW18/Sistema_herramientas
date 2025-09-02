import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    SimpleChanges,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { erpAnimations } from '@erp/animations';
import { ErpNavigationService } from '@erp/components/navigation/navigation.service';
import { ErpNavigationItem } from '@erp/components/navigation/navigation.types';
import { ErpUtilsService } from '@erp/services/utils/utils.service';
import { ReplaySubject, Subject } from 'rxjs';
import { ErpHorizontalNavigationBasicItemComponent } from './components/basic/basic.component';
import { ErpHorizontalNavigationBranchItemComponent } from './components/branch/branch.component';
import { ErpHorizontalNavigationSpacerItemComponent } from './components/spacer/spacer.component';

@Component({
    selector: 'erp-horizontal-navigation',
    templateUrl: './horizontal.component.html',
    styleUrls: ['./horizontal.component.scss'],
    animations: erpAnimations,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'erpHorizontalNavigation',
    imports: [
        ErpHorizontalNavigationBasicItemComponent,
        ErpHorizontalNavigationBranchItemComponent,
        ErpHorizontalNavigationSpacerItemComponent,
    ]
})
export class ErpHorizontalNavigationComponent
    implements OnChanges, OnInit, OnDestroy
{
    private _changeDetectorRef = inject(ChangeDetectorRef);
    private _erpNavigationService = inject(ErpNavigationService);
    private _erpUtilsService = inject(ErpUtilsService);

    @Input() name: string = this._erpUtilsService.randomId();
    @Input() navigation: ErpNavigationItem[];

    onRefreshed: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On changes
     *
     * @param changes
     */
    ngOnChanges(changes: SimpleChanges): void {
        // Navigation
        if ('navigation' in changes) {
            // Mark for check
            this._changeDetectorRef.markForCheck();
        }
    }

    /**
     * On init
     */
    ngOnInit(): void {
        // Make sure the name input is not an empty string
        if (this.name === '') {
            this.name = this._erpUtilsService.randomId();
        }

        // Register the navigation component
        this._erpNavigationService.registerComponent(this.name, this);
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        // Deregister the navigation component from the registry
        this._erpNavigationService.deregisterComponent(this.name);

        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Refresh the component to apply the changes
     */
    refresh(): void {
        // Mark for check
        this._changeDetectorRef.markForCheck();

        // Execute the observable
        this.onRefreshed.next(true);
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
