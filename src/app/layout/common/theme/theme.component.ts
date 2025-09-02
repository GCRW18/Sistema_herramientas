import { Component, OnInit, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ErpConfig, ErpConfigService, Theme } from '../../../../@erp/services/config';
import { Subject, takeUntil } from 'rxjs';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
    selector: 'theme',
    imports: [
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        NgClass,
        NgTemplateOutlet,
        ReactiveFormsModule,
    ],
    templateUrl: './theme.component.html',
})
export class ThemeComponent implements OnInit {
    config: ErpConfig;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    @ViewChild('shortcutsOrigin') private _shortcutsOrigin: MatButton;
    @ViewChild('shortcutsPanel') private _shortcutsPanel: TemplateRef<any>;
    mode: 'view' | 'modify' | 'add' | 'edit' = 'view';
    private _overlayRef: OverlayRef;
    constructor(
        private _erpConfigService: ErpConfigService,
        private _viewContainerRef: ViewContainerRef,
        private _overlay: Overlay
    ) {}

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

    /**
     * Open the shortcuts panel
     */
    openPanel(): void {
        // Return if the shortcuts panel or its origin is not defined
        if (!this._shortcutsPanel || !this._shortcutsOrigin) {
            return;
        }

        // Make sure to start in 'view' mode
        this.mode = 'view';

        // Create the overlay if it doesn't exist
        if (!this._overlayRef) {
            this._createOverlay();
        }

        // Attach the portal to the overlay
        this._overlayRef.attach(
            new TemplatePortal(this._shortcutsPanel, this._viewContainerRef)
        );
    }

    /**
     * Create the overlay
     */
    private _createOverlay(): void {
        // Create the overlay
        this._overlayRef = this._overlay.create({
            hasBackdrop: true,
            backdropClass: 'erp-backdrop-on-mobile',
            scrollStrategy: this._overlay.scrollStrategies.block(),
            positionStrategy: this._overlay
                .position()
                .flexibleConnectedTo(
                    this._shortcutsOrigin._elementRef.nativeElement
                )
                .withLockedPosition(true)
                .withPush(true)
                .withPositions([
                    {
                        originX: 'start',
                        originY: 'bottom',
                        overlayX: 'start',
                        overlayY: 'top',
                    },
                    {
                        originX: 'start',
                        originY: 'top',
                        overlayX: 'start',
                        overlayY: 'bottom',
                    },
                    {
                        originX: 'end',
                        originY: 'bottom',
                        overlayX: 'end',
                        overlayY: 'top',
                    },
                    {
                        originX: 'end',
                        originY: 'top',
                        overlayX: 'end',
                        overlayY: 'bottom',
                    },
                ]),
        });

        // Detach the overlay from the portal on backdrop click
        this._overlayRef.backdropClick().subscribe(() => {
            this._overlayRef.detach();
        });
    }

    /**
     * Set the theme on the config
     *
     * @param theme
     */
    setTheme(theme: Theme): void {
        console.warn('theme', theme);
        this._erpConfigService.config = { theme };
    }

    /**
     * Close the shortcuts panel
     */
    closePanel(): void {
        this._overlayRef.detach();
    }
}
