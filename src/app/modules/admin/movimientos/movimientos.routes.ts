import { Routes } from '@angular/router';
import { pendingChangesGuard } from 'app/core/guards/pending-changes.guard';
import { MovimientosComponent } from './movimientos.component';

export default [
    {
        path: '',
        component: MovimientosComponent,
        canDeactivate: [pendingChangesGuard]
    }
] as Routes;
