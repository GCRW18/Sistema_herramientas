import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ErpNavigationItem } from '@erp/components/navigation';
import { Navigation } from 'app/core/navigation/navigation.types';
import { AppArea, AREA_SUBMODULES } from 'app/core/models/role.types';
import { PermissionsService } from 'app/core/services/permissions.service';
import { combineLatest, map, Observable, ReplaySubject, Subscription, switchMap, take, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationService {
    private _httpClient = inject(HttpClient);
    private _permissionsService = inject(PermissionsService);
    private _navigation: ReplaySubject<Navigation> =
        new ReplaySubject<Navigation>(1);
    private _liveSub?: Subscription;

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for navigation
     */
    get navigation$(): Observable<Navigation> {
        return this._navigation.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all navigation data, sin los módulos que el rol del usuario no puede ver.
     * Después del primer valor el menú se sigue refiltrando solo si cambian los permisos.
     */
    get(): Observable<Navigation> {
        const areas = Object.keys(AREA_SUBMODULES) as AppArea[];
        const access$ = combineLatest(
            Object.fromEntries(areas.map(a => [a, this._permissionsService.canAccessArea(a)]))
        );

        return this._httpClient.get<Navigation>('api/common/navigation').pipe(
            switchMap((navigation) => {
                const filtered$ = access$.pipe(
                    map((access: Record<string, boolean>) => {
                        const filtrar = (items: ErpNavigationItem[]) =>
                            (items || []).filter(item => access[item.id as string] !== false);
                        return {
                            compact:    filtrar(navigation.compact),
                            default:    filtrar(navigation.default),
                            futuristic: filtrar(navigation.futuristic),
                            horizontal: filtrar(navigation.horizontal),
                        };
                    })
                );
                this._liveSub?.unsubscribe();
                this._liveSub = filtered$.subscribe(nav => this._navigation.next(nav));
                return filtered$.pipe(take(1));
            }),
            tap((navigation) => {
                this._navigation.next(navigation);
            })
        );
    }
}
