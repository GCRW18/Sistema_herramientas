import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { ErpFullscreenComponent } from '@erp/components/fullscreen';
import { ErpLoadingBarComponent } from '@erp/components/loading-bar';
import {
    ErpHorizontalNavigationComponent,
    ErpNavigationService,
    ErpVerticalNavigationComponent,
} from '@erp/components/navigation';
import { ErpMediaWatcherService } from '@erp/services/media-watcher';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Navigation } from 'app/core/navigation/navigation.types';
import { LanguagesComponent } from 'app/layout/common/languages/languages.component';
import { NotificationsComponent } from 'app/layout/common/notifications/notifications.component';
import { SearchComponent } from 'app/layout/common/search/search.component';
import { UserComponent } from 'app/layout/common/user/user.component';
import { Subject, takeUntil } from 'rxjs';
import { SchemeComponent } from '../../../common/scheme/scheme.component';
import { ThemeComponent } from '../../../common/theme/theme.component';

@Component({
    selector: 'modern-layout',
    templateUrl: './modern.component.html',
    encapsulation: ViewEncapsulation.None,
    imports: [
        ErpLoadingBarComponent,
        ErpVerticalNavigationComponent,
        ErpHorizontalNavigationComponent,
        MatButtonModule,
        MatIconModule,
        LanguagesComponent,
        ErpFullscreenComponent,
        SearchComponent,
        NotificationsComponent,
        UserComponent,
        RouterOutlet,
        SchemeComponent,
        ThemeComponent,
    ],
})
export class ModernLayoutComponent implements OnInit, OnDestroy {
    isScreenSmall: boolean;
    navigation: Navigation;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _activatedRoute: ActivatedRoute,
        private _router: Router,
        private _navigationService: NavigationService,
        private _erpMediaWatcherService: ErpMediaWatcherService,
        private _erpNavigationService: ErpNavigationService
    ) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for current year
     */
    get currentYear(): number {
        return new Date().getFullYear();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Subscribe to navigation data
        this._navigationService.navigation$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((navigation: Navigation) => {
                this.navigation = navigation;
            });

        // Subscribe to media changes
        this._erpMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                // Check if the screen is small
                this.isScreenSmall = !matchingAliases.includes('md');
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
     * Toggle navigation
     *
     * @param name
     */
    toggleNavigation(name: string): void {
        // Get the navigation
        const navigation =
            this._erpNavigationService.getComponent<ErpVerticalNavigationComponent>(
                name
            );

        if (navigation) {
            // Toggle the opened status
            navigation.toggle();
        }
    }
}
