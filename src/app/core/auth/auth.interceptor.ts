import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandlerFn,
    HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from 'app/core/auth/auth.service';
import { AuthUtils } from 'app/core/auth/auth.utils';
import { Observable, catchError, throwError } from 'rxjs';

/**
 * Intercept
 *
 * @param req
 * @param next
 */
export const authInterceptor = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
    const authService = inject(AuthService);

    // Clone the request object
    let newReq = req.clone();

    // Response
    return next(newReq).pipe(
        catchError((error) => {
            let auth = JSON.parse(localStorage.getItem('aut'));

            // Catch "401 Unauthorized" responses
            if ( error instanceof HttpErrorResponse && error.status === 401 || auth == null )
            {
                // Sign out
                authService.redirect();

                // Reload the app
                location.reload();
            }

            return throwError(error);
        })
    );
};
