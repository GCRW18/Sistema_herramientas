import { Injectable } from '@angular/core';
import { ErpDrawerComponent } from '@erp/components/drawer/drawer.component';

@Injectable({ providedIn: 'root' })
export class ErpDrawerService {
    private _componentRegistry: Map<string, ErpDrawerComponent> = new Map<
        string,
        ErpDrawerComponent
    >();

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Register drawer component
     *
     * @param name
     * @param component
     */
    registerComponent(name: string, component: ErpDrawerComponent): void {
        this._componentRegistry.set(name, component);
    }

    /**
     * Deregister drawer component
     *
     * @param name
     */
    deregisterComponent(name: string): void {
        this._componentRegistry.delete(name);
    }

    /**
     * Get drawer component from the registry
     *
     * @param name
     */
    getComponent(name: string): ErpDrawerComponent | undefined {
        return this._componentRegistry.get(name);
    }
}
