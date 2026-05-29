import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { NotificationsService } from 'app/layout/common/notifications/notifications.service';

import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UserService } from './core/user/user.service';

export const initialDataResolver = () => {
    const navigationService = inject(NavigationService);
    const notificationsService = inject(NotificationsService);
    const _userService = inject(UserService);
    const router = inject(Router);

    // Fork join multiple API endpoint calls to wait all of them to finish
    return forkJoin([
        navigationService.get().pipe(catchError(() => of(null))),
        notificationsService.getAll().pipe(catchError(() => of([]))),
        _userService.get().pipe(catchError(() => {
            localStorage.removeItem('aut');
            router.navigate(['/sign-in']);
            return of(null);
        })),
    ]);
};
