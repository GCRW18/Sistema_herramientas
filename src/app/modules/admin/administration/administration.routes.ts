import { Routes } from '@angular/router';
import { pendingChangesGuard } from 'app/core/guards/pending-changes.guard';
import { AdministrationComponent } from './administration.component';

export default [
    {
        path: '',
        component: AdministrationComponent,
        canDeactivate: [pendingChangesGuard]
    }
] as Routes;
