import { Injectable, inject } from '@angular/core';
import { from, Observable, of, ReplaySubject, switchMap, tap } from 'rxjs';
import { ErpApiService } from '../api/api.service';

export interface Kit {
    id?: string;
    code?: string;
    name: string;
    description: string;
    status: 'active' | 'inactive' | 'in_use' | 'incomplete';
    category?: string;
    location?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    items?: KitItem[];
    totalItems?: number;
    availableItems?: number;
    completionPercentage?: number;
}

export interface KitItem {
    id?: string;
    kitId?: string;
    toolId: string;
    toolName?: string;
    toolCode?: string;
    quantity: number;
    isOptional: boolean;
    alternatives?: string[]; // Array of tool IDs that can replace this item
    notes?: string;
}

export interface KitFilters {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
}

@Injectable({ providedIn: 'root' })
export class KitsService {
    private _api = inject(ErpApiService);
    private _kits: ReplaySubject<Kit[]> = new ReplaySubject<Kit[]>(1);
    private _kit: ReplaySubject<Kit | null> = new ReplaySubject<Kit | null>(1);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for kits
     */
    get kits$(): Observable<Kit[]> {
        return this._kits.asObservable();
    }

    /**
     * Getter for kit
     */
    get kit$(): Observable<Kit | null> {
        return this._kit.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Kits CRUD
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all kits
     */
    getKits(filters?: KitFilters): Observable<Kit[]> {
        const params = {
            start: ((filters?.page || 1) - 1) * (filters?.limit || 50),
            limit: filters?.limit || 50,
            sort: 'name',
            dir: 'asc',
            ...filters
        };

        return from(this._api.post('herramientas/kits/listKits', params)).pipe(
            switchMap((response: any) => {
                const kits = response?.datos || [];
                this._kits.next(kits);
                return of(kits);
            })
        );
    }

    /**
     * Get kit by id
     */
    getKitById(id: string): Observable<Kit> {
        return from(this._api.post('herramientas/kits/listKits', {
            start: 0,
            limit: 1,
            id_kit: id
        })).pipe(
            switchMap((response: any) => {
                const kit = response?.datos?.[0] || null;
                if (kit) {
                    this._kit.next(kit);
                }
                return of(kit);
            })
        );
    }

    /**
     * Get kit by code
     */
    getKitByCode(code: string): Observable<Kit> {
        return from(this._api.post('herramientas/kits/listKits', {
            start: 0,
            limit: 1,
            code: code
        })).pipe(
            switchMap((response: any) => {
                const kit = response?.datos?.[0] || null;
                if (kit) {
                    this._kit.next(kit);
                }
                return of(kit);
            })
        );
    }

    /**
     * Create new kit
     */
    createKit(kit: Partial<Kit>): Observable<Kit> {
        return from(this._api.post('herramientas/kits/insertKit', kit)).pipe(
            switchMap((response: any) => {
                const newKit = response?.datos || kit;
                // Refresh kits list
                this.getKits().subscribe();
                return of(newKit);
            })
        );
    }

    /**
     * Update kit
     */
    updateKit(id: string, kit: Partial<Kit>): Observable<Kit> {
        return from(this._api.post('herramientas/kits/updateKit', {
            ...kit,
            id_kit: id
        })).pipe(
            switchMap((response: any) => {
                const updatedKit = response?.datos || kit;
                // Refresh kits list
                this.getKits().subscribe();
                return of(updatedKit);
            })
        );
    }

    /**
     * Delete kit
     */
    deleteKit(id: string): Observable<boolean> {
        return from(this._api.post('herramientas/kits/deleteKit', {
            id_kit: id
        })).pipe(
            switchMap((response: any) => {
                // Refresh kits list
                this.getKits().subscribe();
                return of(response?.success || true);
            })
        );
    }

    /**
     * Change kit status
     */
    changeKitStatus(id: string, status: Kit['status']): Observable<Kit> {
        return from(this._api.post('herramientas/kits/updateKit', {
            id_kit: id,
            status: status
        })).pipe(
            switchMap((response: any) => {
                const updatedKit = response?.datos || {};
                // Refresh kits list
                this.getKits().subscribe();
                return of(updatedKit);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Kit Items Management
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get kit items
     */
    getKitItems(kitId: string): Observable<KitItem[]> {
        return from(this._api.post('herramientas/kits/listKitItems', {
            kit_id: kitId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Add item to kit
     */
    addKitItem(kitId: string, item: Partial<KitItem>): Observable<KitItem> {
        return from(this._api.post('herramientas/kits/insertKitItem', {
            ...item,
            kit_id: kitId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || item);
            })
        );
    }

    /**
     * Update kit item
     */
    updateKitItem(itemId: string, item: Partial<KitItem>): Observable<KitItem> {
        return from(this._api.post('herramientas/kits/updateKitItem', {
            ...item,
            id_kit_item: itemId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || item);
            })
        );
    }

    /**
     * Remove item from kit
     */
    removeKitItem(itemId: string): Observable<boolean> {
        return from(this._api.post('herramientas/kits/deleteKitItem', {
            id_kit_item: itemId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.success || true);
            })
        );
    }

    /**
     * Bulk add items to kit
     */
    bulkAddKitItems(kitId: string, items: Partial<KitItem>[]): Observable<KitItem[]> {
        return from(this._api.post('herramientas/kits/bulkInsertKitItems', {
            kit_id: kitId,
            items: items
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || items);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Kit Verification & Status
    // -----------------------------------------------------------------------------------------------------

    /**
     * Verify kit completeness
     * Returns which items are available, missing, in use, etc.
     */
    verifyKitStatus(kitId: string): Observable<any> {
        return from(this._api.post('herramientas/kits/verifyKitStatus', {
            kit_id: kitId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {
                    isComplete: false,
                    availableItems: [],
                    missingItems: [],
                    itemsInUse: [],
                    itemsRequiringCalibration: []
                });
            })
        );
    }

    /**
     * Check if kit can be loaned
     */
    checkKitAvailability(kitId: string): Observable<{
        available: boolean;
        missingItems: string[];
        itemsInUse: string[];
    }> {
        return from(this._api.post('herramientas/kits/checkAvailability', {
            kit_id: kitId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {
                    available: false,
                    missingItems: [],
                    itemsInUse: []
                });
            })
        );
    }

    /**
     * Loan complete kit
     */
    loanKit(kitId: string, loanData: any): Observable<any> {
        return from(this._api.post('herramientas/kits/loanKit', {
            kit_id: kitId,
            ...loanData
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    /**
     * Return kit from loan
     */
    returnKit(kitId: string, returnData: any): Observable<any> {
        return from(this._api.post('herramientas/kits/returnKit', {
            kit_id: kitId,
            ...returnData
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {});
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Statistics & Reports
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get kits statistics
     */
    getKitsStatistics(): Observable<any> {
        return from(this._api.post('herramientas/kits/getStatistics', {})).pipe(
            switchMap((response: any) => {
                return of(response?.datos || {
                    totalKits: 0,
                    activeKits: 0,
                    inactiveKits: 0,
                    kitsInUse: 0,
                    incompleteKits: 0,
                    totalItems: 0
                });
            })
        );
    }

    /**
     * Get kit usage history
     */
    getKitHistory(kitId: string): Observable<any[]> {
        return from(this._api.post('herramientas/kits/getKitHistory', {
            kit_id: kitId
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    /**
     * Get most used kits
     */
    getMostUsedKits(limit: number = 10): Observable<any[]> {
        return from(this._api.post('herramientas/kits/getMostUsedKits', {
            limit: limit
        })).pipe(
            switchMap((response: any) => {
                return of(response?.datos || []);
            })
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods - Export & Print
    // -----------------------------------------------------------------------------------------------------

    /**
     * Export kits list to Excel
     */
    exportKitsToExcel(filters?: KitFilters): Observable<Blob> {
        return from(this._api.post('herramientas/kits/exportToExcel', filters || {}, {
            responseType: 'blob'
        })).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }

    /**
     * Generate kit label/QR code
     */
    generateKitLabel(kitId: string): Observable<Blob> {
        return from(this._api.post('herramientas/kits/generateLabel', {
            kit_id: kitId
        }, {
            responseType: 'blob'
        })).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }
}
