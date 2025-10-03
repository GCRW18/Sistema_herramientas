import { Injectable } from '@angular/core';
import { ErpMockApiService, ErpMockApiUtils } from '@erp/lib/mock-api';
import { tools as toolsData, categories as categoriesData, subcategories as subcategoriesData,
         warehouses as warehousesData, locations as locationsData, inventorySummary } from './data';
import { assign, cloneDeep } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class ToolsMockApi {
    private _tools: any[] = toolsData;
    private _categories: any[] = categoriesData;
    private _subcategories: any[] = subcategoriesData;
    private _warehouses: any[] = warehousesData;
    private _locations: any[] = locationsData;

    constructor(private _erpMockApiService: ErpMockApiService) {
        this.registerHandlers();
    }

    registerHandlers(): void {
        // Tools
        this._erpMockApiService
            .onGet('api/tools')
            .reply(() => [200, cloneDeep(this._tools)]);

        this._erpMockApiService
            .onGet('api/tools/inventory/summary')
            .reply(() => [200, inventorySummary]);

        this._erpMockApiService
            .onGet('api/tools/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const tool = cloneDeep(this._tools.find(item => item.id === id));
                return [200, tool];
            });

        this._erpMockApiService
            .onPost('api/tools')
            .reply(({ request }) => {
                const newTool = cloneDeep(request.body);
                newTool.id = ErpMockApiUtils.guid();
                newTool.createdAt = new Date().toISOString();
                newTool.updatedAt = new Date().toISOString();
                newTool.active = true;
                this._tools.unshift(newTool);
                return [200, newTool];
            });

        this._erpMockApiService
            .onPut('api/tools/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const tool = this._tools.find(item => item.id === id);
                if (tool) {
                    assign(tool, request.body);
                    tool.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(tool)];
            });

        this._erpMockApiService
            .onDelete('api/tools/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const index = this._tools.findIndex(item => item.id === id);
                if (index > -1) {
                    this._tools.splice(index, 1);
                }
                return [200, true];
            });

        // Categories
        this._erpMockApiService
            .onGet('api/categories')
            .reply(() => [200, cloneDeep(this._categories)]);

        this._erpMockApiService
            .onGet('api/subcategories')
            .reply(({ request }) => {
                const categoryId = request.params.get('categoryId');
                const subcategories = categoryId
                    ? this._subcategories.filter(item => item.categoryId === categoryId)
                    : this._subcategories;
                return [200, cloneDeep(subcategories)];
            });

        // Warehouses
        this._erpMockApiService
            .onGet('api/warehouses')
            .reply(() => [200, cloneDeep(this._warehouses)]);

        this._erpMockApiService
            .onGet('api/warehouses/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const warehouse = cloneDeep(this._warehouses.find(item => item.id === id));
                return [200, warehouse];
            });

        this._erpMockApiService
            .onPost('api/warehouses')
            .reply(({ request }) => {
                const newWarehouse = cloneDeep(request.body);
                newWarehouse.id = ErpMockApiUtils.guid();
                newWarehouse.createdAt = new Date().toISOString();
                newWarehouse.updatedAt = new Date().toISOString();
                newWarehouse.active = true;
                this._warehouses.unshift(newWarehouse);
                return [200, newWarehouse];
            });

        // Locations
        this._erpMockApiService
            .onGet('api/locations')
            .reply(({ request }) => {
                const warehouseId = request.params.get('warehouseId');
                const locations = warehouseId
                    ? this._locations.filter(item => item.warehouseId === warehouseId)
                    : this._locations;
                return [200, cloneDeep(locations)];
            });

        this._erpMockApiService
            .onPost('api/locations')
            .reply(({ request }) => {
                const newLocation = cloneDeep(request.body);
                newLocation.id = ErpMockApiUtils.guid();
                newLocation.createdAt = new Date().toISOString();
                newLocation.updatedAt = new Date().toISOString();
                newLocation.active = true;
                this._locations.unshift(newLocation);
                return [200, newLocation];
            });
    }
}
