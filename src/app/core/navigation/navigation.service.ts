import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ErpNavigationItem } from '@erp/components/navigation';
import { Navigation } from 'app/core/navigation/navigation.types';
import { AppArea, AREA_SUBMODULES } from 'app/core/models/role.types';
import { PermissionsService } from 'app/core/services/permissions.service';
import { forkJoin, map, Observable, ReplaySubject, switchMap, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationService {
    private _httpClient = inject(HttpClient);
    private _permissionsService = inject(PermissionsService);
    private _navigation: ReplaySubject<Navigation> =
        new ReplaySubject<Navigation>(1);

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
     * Get all navigation data, sin los módulos que el rol del usuario no puede ver
     */
    get(): Observable<Navigation> {
        const areas = Object.keys(AREA_SUBMODULES) as AppArea[];
        const access$ = forkJoin(
            Object.fromEntries(areas.map(a => [a, this._permissionsService.canAccessArea(a)]))
        );

        return this._httpClient.get<Navigation>('api/common/navigation').pipe(
            switchMap((navigation) => access$.pipe(
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
            )),
            tap((navigation) => {
                this._navigation.next(navigation);
            })
        );
    }
}
