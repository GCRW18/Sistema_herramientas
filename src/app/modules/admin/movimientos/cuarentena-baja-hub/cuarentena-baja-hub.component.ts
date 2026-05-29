import { Component, Injector, OnInit, Type, inject } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { of } from 'rxjs';

@Component({
    selector: 'app-cuarentena-baja-hub',
    standalone: true,
    imports: [CommonModule, NgComponentOutlet, MatIconModule, MatProgressSpinnerModule],
    templateUrl: './cuarentena-baja-hub.component.html',
    styles: [':host { display: flex; flex-direction: column; height: 100%; }']
})
export class CuarentenaBajaHubComponent implements OnInit {
    private parentInjector = inject(Injector);

    activeTab: 'cuarentena' | 'baja' = 'cuarentena';
    loading = true;

    cuarentenaComp: Type<any> | null = null;
    bajaComp:       Type<any> | null = null;
    cuarentenaInj:  Injector | null = null;
    bajaInj:        Injector | null = null;

    async ngOnInit() {
        const [c, b] = await Promise.all([
            import('../poner-cuarentena/poner-cuarentena.component').then(m => m.PonerCuarentenaComponent),
            import('../baja/baja.component').then(m => m.BajaComponent)
        ]);
        this.cuarentenaComp = c;
        this.bajaComp       = b;
        this.cuarentenaInj  = this.makeInjector('hub-cuarentena');
        this.bajaInj        = this.makeInjector('hub-baja');
        this.loading = false;
    }

    private makeInjector(id: string): Injector {
        const fakeRef = {
            close: () => {}, afterClosed: () => of(null), beforeClosed: () => of(null),
            backdropClick: () => of(null), keydownEvents: () => of(null),
            updatePosition: () => {}, updateSize: () => {}, addPanelClass: () => {}, removePanelClass: () => {},
            disableClose: false, id, componentInstance: null,
            afterOpened: () => of(null)
        };
        return Injector.create({ parent: this.parentInjector, providers: [{ provide: MatDialogRef, useValue: fakeRef }] });
    }
}
