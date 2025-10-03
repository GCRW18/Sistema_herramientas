import { Injectable } from '@angular/core';
import { ErpMockApiService, ErpMockApiUtils } from '@erp/lib/mock-api';
import { kits as kitsData } from './data';
import { assign, cloneDeep } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class KitsMockApi {
    private _kits: any[] = kitsData;

    constructor(private _erpMockApiService: ErpMockApiService) {
        this.registerHandlers();
    }

    registerHandlers(): void {
        // Get all kits
        this._erpMockApiService
            .onGet('api/kits')
            .reply(() => [200, cloneDeep(this._kits)]);

        // Get kit by ID
        this._erpMockApiService
            .onGet('api/kits/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const kit = cloneDeep(this._kits.find(item => item.id === id));
                return [200, kit];
            });

        // Create kit
        this._erpMockApiService
            .onPost('api/kits')
            .reply(({ request }) => {
                const newKit = cloneDeep(request.body);
                newKit.id = ErpMockApiUtils.guid();
                newKit.createdAt = new Date().toISOString();
                newKit.updatedAt = new Date().toISOString();
                newKit.status = 'incomplete';
                this._kits.unshift(newKit);
                return [200, newKit];
            });

        // Update kit
        this._erpMockApiService
            .onPut('api/kits/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const kit = this._kits.find(item => item.id === id);
                if (kit) {
                    assign(kit, request.body);
                    kit.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(kit)];
            });

        // Delete kit
        this._erpMockApiService
            .onDelete('api/kits/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const index = this._kits.findIndex(item => item.id === id);
                if (index > -1) {
                    this._kits.splice(index, 1);
                }
                return [200, true];
            });

        // Add tool to kit
        this._erpMockApiService
            .onPost('api/kits/:id/tools')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const data = cloneDeep(request.body);
                const kit = this._kits.find(item => item.id === id);

                if (kit) {
                    const newItem = {
                        id: ErpMockApiUtils.guid(),
                        kitId: id,
                        toolId: data.toolId,
                        quantity: data.quantity || 1,
                        required: data.required || false
                    };

                    if (!kit.items) {
                        kit.items = [];
                    }
                    kit.items.push(newItem);
                    kit.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(kit)];
            });

        // Remove tool from kit
        this._erpMockApiService
            .onDelete('api/kits/:kitId/tools/:itemId')
            .reply(({ request }) => {
                const kitId = request.params.get('kitId');
                const itemId = request.params.get('itemId');
                const kit = this._kits.find(item => item.id === kitId);

                if (kit && kit.items) {
                    kit.items = kit.items.filter((item: any) => item.id !== itemId);
                    kit.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(kit)];
            });

        // Update kit item
        this._erpMockApiService
            .onPut('api/kits/:kitId/tools/:itemId')
            .reply(({ request }) => {
                const kitId = request.params.get('kitId');
                const itemId = request.params.get('itemId');
                const data = request.body;
                const kit = this._kits.find(item => item.id === kitId);

                if (kit && kit.items) {
                    const itemIndex = kit.items.findIndex((item: any) => item.id === itemId);
                    if (itemIndex > -1) {
                        assign(kit.items[itemIndex], data);
                        kit.updatedAt = new Date().toISOString();
                    }
                }
                return [200, cloneDeep(kit)];
            });

        // Get kit calibration status
        this._erpMockApiService
            .onGet('api/kits/:id/calibration-status')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const kit = cloneDeep(this._kits.find(item => item.id === id));

                if (kit) {
                    const toolsRequiringCalibration = kit.items?.filter((item: any) =>
                        item.tool?.requiresCalibration
                    ).length || 0;

                    const status = {
                        kit: kit,
                        toolsRequiringCalibration: toolsRequiringCalibration,
                        toolsCalibrated: Math.floor(toolsRequiringCalibration * 0.8), // Mock 80% calibrated
                        toolsExpired: toolsRequiringCalibration > 0 ? Math.floor(toolsRequiringCalibration * 0.2) : 0, // Mock 20% expired
                        nextExpirationDate: kit.nextCalibrationDate,
                        isComplete: toolsRequiringCalibration === 0 || Math.random() > 0.3
                    };
                    return [200, status];
                }
                return [404, null];
            });

        // Get all kits calibration status
        this._erpMockApiService
            .onGet('api/kits/calibration-status')
            .reply(() => {
                const statuses = this._kits
                    .filter(kit => kit.requiresCalibration)
                    .map(kit => {
                        const toolsRequiringCalibration = kit.items?.filter((item: any) =>
                            item.tool?.requiresCalibration
                        ).length || 0;

                        return {
                            kit: cloneDeep(kit),
                            toolsRequiringCalibration: toolsRequiringCalibration,
                            toolsCalibrated: Math.floor(toolsRequiringCalibration * 0.8),
                            toolsExpired: toolsRequiringCalibration > 0 ? Math.floor(toolsRequiringCalibration * 0.2) : 0,
                            nextExpirationDate: kit.nextCalibrationDate,
                            isComplete: toolsRequiringCalibration === 0 || Math.random() > 0.3
                        };
                    });
                return [200, statuses];
            });
    }
}
