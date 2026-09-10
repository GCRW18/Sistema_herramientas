import { Routes } from '@angular/router';
import { pendingChangesGuard } from 'app/core/guards/pending-changes.guard';
import { InventoryComponent } from './inventory.component';

export default [
    {
        path: '',
        component: InventoryComponent,
        canDeactivate: [pendingChangesGuard]
    }
] as Routes;
