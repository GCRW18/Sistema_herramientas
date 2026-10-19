import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppArea } from 'app/core/models/role.types';
import { PermissionsService } from 'app/core/services/permissions.service';
import { map } from 'rxjs';

/** Bloquea entrar por URL a un módulo que el rol del usuario no tiene; redirige al Dashboard. */
export const areaGuard = (area: AppArea): CanActivateFn => () => {
    const router = inject(Router);
    return inject(PermissionsService).canAccessArea(area).pipe(
        map(ok => ok || router.parseUrl('/dashboard'))
    );
};
