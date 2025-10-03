import { Injectable } from '@angular/core';
import { ErpMockApiService, ErpMockApiUtils } from '@erp/lib/mock-api';
import { calibrationRecords as calibrationData, calibrationAlerts, maintenanceRecords } from './data';
import { assign, cloneDeep } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class CalibrationMockApi {
    private _calibrations: any[] = calibrationData;
    private _alerts: any[] = calibrationAlerts;
    private _maintenance: any[] = maintenanceRecords;

    constructor(private _erpMockApiService: ErpMockApiService) {
        this.registerHandlers();
    }

    registerHandlers(): void {
        // Get all calibration records
        this._erpMockApiService
            .onGet('api/calibrations')
            .reply(() => [200, cloneDeep(this._calibrations)]);

        // Get calibration alerts
        this._erpMockApiService
            .onGet('api/calibrations/alerts')
            .reply(() => [200, cloneDeep(this._alerts)]);

        // Get critical alerts
        this._erpMockApiService
            .onGet('api/calibrations/alerts/critical')
            .reply(() => {
                const critical = this._alerts.filter(a => a.severity === 'critical');
                return [200, cloneDeep(critical)];
            });

        // Get calibration by ID
        this._erpMockApiService
            .onGet('api/calibrations/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const calibration = cloneDeep(this._calibrations.find(item => item.id === id));
                return [200, calibration];
            });

        // Create calibration record
        this._erpMockApiService
            .onPost('api/calibrations')
            .reply(({ request }) => {
                const newCalibration = cloneDeep(request.body);
                newCalibration.id = ErpMockApiUtils.guid();
                newCalibration.createdAt = new Date().toISOString();
                newCalibration.updatedAt = new Date().toISOString();
                this._calibrations.unshift(newCalibration);
                return [200, newCalibration];
            });

        // Send tool to calibration
        this._erpMockApiService
            .onPost('api/calibrations/send')
            .reply(({ request }) => {
                const data = cloneDeep(request.body);
                const calibrationRecord = {
                    id: ErpMockApiUtils.guid(),
                    toolId: data.toolId,
                    provider: data.provider,
                    sendDate: data.sendDate,
                    estimatedReturnDate: data.estimatedReturnDate,
                    calibrationType: data.calibrationType,
                    cost: data.cost,
                    notes: data.notes,
                    status: 'in_process',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                this._calibrations.unshift(calibrationRecord);
                return [200, calibrationRecord];
            });

        // Receive tool from calibration
        this._erpMockApiService
            .onPost('api/calibrations/receive')
            .reply(({ request }) => {
                const data = cloneDeep(request.body);
                const calibration = this._calibrations.find(c => c.id === data.calibrationId);
                if (calibration) {
                    calibration.calibrationDate = data.returnDate;
                    calibration.nextCalibrationDate = data.nextCalibrationDate;
                    calibration.certificateNumber = data.certificateNumber;
                    calibration.result = data.result;
                    calibration.status = 'completed';
                    calibration.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(calibration)];
            });

        this._erpMockApiService
            .onPost('api/calibrations/:id/receive')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const data = cloneDeep(request.body);
                const calibration = this._calibrations.find(c => c.id === id);
                if (calibration) {
                    assign(calibration, data);
                    calibration.status = 'completed';
                    calibration.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(calibration)];
            });

        this._erpMockApiService
            .onPut('api/calibrations/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const calibration = this._calibrations.find(item => item.id === id);
                if (calibration) {
                    assign(calibration, request.body);
                    calibration.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(calibration)];
            });

        this._erpMockApiService
            .onPost('api/calibrations/:id/cancel')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const data = cloneDeep(request.body);
                const calibration = this._calibrations.find(c => c.id === id);
                if (calibration) {
                    calibration.status = 'cancelled';
                    calibration.cancelReason = data.reason;
                    calibration.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(calibration)];
            });

        this._erpMockApiService
            .onGet('api/calibrations/tool/:toolId')
            .reply(({ request }) => {
                const toolId = request.params.get('toolId');
                const toolCalibrations = this._calibrations.filter(c => c.toolId === toolId);
                return [200, cloneDeep(toolCalibrations)];
            });

        // Maintenance records
        this._erpMockApiService
            .onGet('api/maintenances')
            .reply(() => [200, cloneDeep(this._maintenance)]);

        this._erpMockApiService
            .onGet('api/maintenances/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const maintenance = cloneDeep(this._maintenance.find(item => item.id === id));
                return [200, maintenance];
            });

        this._erpMockApiService
            .onGet('api/maintenances/tool/:toolId')
            .reply(({ request }) => {
                const toolId = request.params.get('toolId');
                const toolMaintenances = this._maintenance.filter(m => m.toolId === toolId);
                return [200, cloneDeep(toolMaintenances)];
            });

        this._erpMockApiService
            .onPost('api/maintenances')
            .reply(({ request }) => {
                const newMaintenance = cloneDeep(request.body);
                newMaintenance.id = ErpMockApiUtils.guid();
                newMaintenance.createdAt = new Date().toISOString();
                newMaintenance.updatedAt = new Date().toISOString();
                this._maintenance.unshift(newMaintenance);
                return [200, newMaintenance];
            });

        this._erpMockApiService
            .onPost('api/maintenances/send')
            .reply(({ request }) => {
                const newMaintenance = cloneDeep(request.body);
                newMaintenance.id = ErpMockApiUtils.guid();
                newMaintenance.status = 'in_process';
                newMaintenance.createdAt = new Date().toISOString();
                newMaintenance.updatedAt = new Date().toISOString();
                this._maintenance.unshift(newMaintenance);
                return [200, newMaintenance];
            });

        this._erpMockApiService
            .onPost('api/maintenances/:id/receive')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const data = cloneDeep(request.body);
                const maintenance = this._maintenance.find(m => m.id === id);
                if (maintenance) {
                    assign(maintenance, data);
                    maintenance.status = 'completed';
                    maintenance.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(maintenance)];
            });

        this._erpMockApiService
            .onPut('api/maintenances/:id')
            .reply(({ request }) => {
                const id = request.params.get('id');
                const maintenance = this._maintenance.find(item => item.id === id);
                if (maintenance) {
                    assign(maintenance, request.body);
                    maintenance.updatedAt = new Date().toISOString();
                }
                return [200, cloneDeep(maintenance)];
            });
    }
}
