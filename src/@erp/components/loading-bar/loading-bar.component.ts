import { coerceBooleanProperty } from '@angular/cdk/coercion';

import {
    Component,
    inject,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    SimpleChanges,
    ViewEncapsulation,
    ChangeDetectorRef,
    ChangeDetectionStrategy,
    AfterViewInit
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ErpLoadingService } from '@erp/services/loading';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'erp-loading-bar',
    templateUrl: './loading-bar.component.html',
    styleUrls: ['./loading-bar.component.scss'],
    encapsulation: ViewEncapsulation.None,
    exportAs: 'erpLoadingBar',
    imports: [MatProgressBarModule],
    changeDetection: ChangeDetectionStrategy.OnPush  // ← Mejora el rendimiento y evita errores de detección
})
export class ErpLoadingBarComponent implements OnChanges, OnInit, OnDestroy, AfterViewInit {
    private _erpLoadingService = inject(ErpLoadingService);
    private _cdr = inject(ChangeDetectorRef);  // ← Para forzar detección de cambios cuando sea necesario

    @Input() autoMode: boolean = true;
    mode: 'determinate' | 'indeterminate' = 'indeterminate';  // ← Inicializado correctamente
    progress: number = 0;  // ← Cambiado de -1 a 0 (valor por defecto seguro)
    show: boolean = false;
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
        // Auto mode
        if ('autoMode' in changes) {
            // Set the auto mode in the service
            this._erpLoadingService.setAutoMode(
                coerceBooleanProperty(changes.autoMode.currentValue)
            );
        }
    }

    /**
     * On init
     */
    ngOnInit(): void {
        // Subscribe to the service
        this._erpLoadingService.mode$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((value) => {
                this.mode = value;
                this._cdr.detectChanges();  // ← Forzar detección de cambios
            });

        this._erpLoadingService.progress$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((value) => {
                // ← Asegurar que el progreso nunca sea negativo ni mayor a 100
                this.progress = Math.max(0, Math.min(100, value || 0));
                this._cdr.detectChanges();  // ← Forzar detección de cambios
            });

        this._erpLoadingService.show$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((value) => {
                this.show = value;
                this._cdr.detectChanges();  // ← Forzar detección de cambios
            });
    }

    /**
     * After view init
     */
    ngAfterViewInit(): void {
        // Forzar detección de cambios después de que la vista esté lista
        this._cdr.detectChanges();
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
