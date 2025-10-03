import { Injectable } from '@angular/core';
import { ErpMockApiService, ErpMockApiUtils } from '@erp/lib/mock-api';
import { quarantineRecords, decommissionRecords } from './data';
import { assign, cloneDeep } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class QuarantineMockApi {
    private _quarantines: any[] = quarantineRecords;
    private _decommissions: any[] = decommissionRecords;

    constructor(private _erpMockApiService: ErpMockApiService) {
        this.registerHandlers();
    }

    registerHandlers(): void {
        // Quarantine endpoints
        this._erpMockApiService
            .onGet('api/quarantines')
            .reply(() => [200, cloneDeep(this._quarantines)]);

        this._erpMockApiService
            .onGet('api/quarantines/active')
            .reply(() => {
                const active = this._quarantines.filter(q => q.status === 'active');
                return [200, cloneDeep(active)];
            });

        this._erpMockApiService
            .onGet('api/quarantines/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const quarantine = cloneDeep(this._quarantines.find(item => item.id === id));
                return [200, quarantine];
            });

        this._erpMockApiService
            .onPost('api/quarantines')
            .reply(({ request }) => {
                const newQuarantine = cloneDeep(request.body);
                newQuarantine.id = ErpMockApiUtils.guid();
                newQuarantine.createdAt = new Date().toISOString();
                newQuarantine.updatedAt = new Date().toISOString();
                newQuarantine.status = 'active';
                this._quarantines.unshift(newQuarantine);
                return [200, newQuarantine];
            });

        this._erpMockApiService
            .onPut('api/quarantines/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const quarantine = this._quarantines.find(item => item.id === id);
                if (quarantine) {
                    assign(quarantine, request.body);
                    quarantine.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(quarantine)];
            });

        // Release from quarantine
        this._erpMockApiService
            .onPost('api/quarantines/:id/release')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const quarantine = this._quarantines.find(item => item.id === id);
                if (quarantine) {
                    quarantine.status = 'resolved';
                    quarantine.resolvedDate = new Date().toISOString();
                    quarantine.resolution = request.body.resolution;
                    quarantine.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(quarantine)];
            });

        // Resolve quarantine
        this._erpMockApiService
            .onPost('api/quarantines/:id/resolve')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const data = request.body;
                const quarantine = this._quarantines.find(item => item.id === id);
                if (quarantine) {
                    quarantine.status = 'resolved';
                    quarantine.resolvedDate = new Date().toISOString();
                    quarantine.resolution = data.resolution;
                    quarantine.actionTaken = data.actionTaken;
                    quarantine.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(quarantine)];
            });

        // Cancel quarantine
        this._erpMockApiService
            .onPost('api/quarantines/:id/cancel')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const quarantine = this._quarantines.find(item => item.id === id);
                if (quarantine) {
                    quarantine.status = 'cancelled';
                    quarantine.cancelledDate = new Date().toISOString();
                    quarantine.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(quarantine)];
            });

        // Decommission endpoints
        this._erpMockApiService
            .onGet('api/decommissions')
            .reply(() => [200, cloneDeep(this._decommissions)]);

        this._erpMockApiService
            .onGet('api/decommissions/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const decommission = cloneDeep(this._decommissions.find(item => item.id === id));
                return [200, decommission];
            });

        this._erpMockApiService
            .onPost('api/decommissions')
            .reply(({ request }) => {
                const newDecommission = cloneDeep(request.body);
                newDecommission.id = ErpMockApiUtils.guid();
                newDecommission.createdAt = new Date().toISOString();
                newDecommission.updatedAt = new Date().toISOString();
                newDecommission.status = 'pending';
                this._decommissions.unshift(newDecommission);
                return [200, newDecommission];
            });

        this._erpMockApiService
            .onPut('api/decommissions/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const decommission = this._decommissions.find(item => item.id === id);
                if (decommission) {
                    assign(decommission, request.body);
                    decommission.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(decommission)];
            });

        // Approve decommission
        this._erpMockApiService
            .onPost('api/decommissions/:id/approve')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const decommission = this._decommissions.find(item => item.id === id);
                if (decommission) {
                    decommission.status = 'approved';
                    decommission.approvedBy = request.body.approvedBy;
                    decommission.date = new Date().toISOString();
                    decommission.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(decommission)];
            });
    }
}
