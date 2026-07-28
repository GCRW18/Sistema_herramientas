import { Directive, Input, OnDestroy, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { PermissionsService } from '../services/permissions.service';

/**
 * *appHasPermission="'kits.create'" — oculta el elemento si el usuario logueado
 * no tiene ese permiso en el JSON de su rol asignado (he.roles.permissions).
 * Fail-open mientras el usuario no tenga rol asignado — ver PermissionsService.can().
 */
@Directive({
    selector: '[appHasPermission]',
    standalone: true
})
export class HasPermissionDirective implements OnDestroy {
    private _templateRef = inject(TemplateRef<any>);
    private _viewContainer = inject(ViewContainerRef);
    private _permissionsSvc = inject(PermissionsService);
    private _sub: Subscription | null = null;

    @Input() set appHasPermission(permissionId: string) {
        this._sub?.unsubscribe();
        this._sub = this._permissionsSvc.can(permissionId).subscribe(allowed => {
            this._viewContainer.clear();
            if (allowed) {
                this._viewContainer.createEmbeddedView(this._templateRef);
            }
        });
    }

    ngOnDestroy(): void {
        this._sub?.unsubscribe();
    }
}
