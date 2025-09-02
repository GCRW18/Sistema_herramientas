import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
    EnvironmentProviders,
    Provider,
    importProvidersFrom,
    inject,
    provideEnvironmentInitializer,
    provideAppInitializer,
    APP_INITIALIZER,
} from '@angular/core';
import { MATERIAL_SANITY_CHECKS } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
    ERP_MOCK_API_DEFAULT_DELAY,
    mockApiInterceptor,
} from '@erp/lib/mock-api';
import { ErpConfig } from '@erp/services/config';
import { ERP_CONFIG } from '@erp/services/config/config.constants';
import { ErpConfirmationService } from '@erp/services/confirmation';
import {
    ErpLoadingService,
    erpLoadingInterceptor,
} from '@erp/services/loading';
import { ErpMediaWatcherService } from '@erp/services/media-watcher';
import { ErpPlatformService } from '@erp/services/platform';
import { ErpSplashScreenService } from '@erp/services/splash-screen';
import { ErpUtilsService } from '@erp/services/utils';

export type ErpProviderConfig = {
    mockApi?: {
        delay?: number;
        services?: any[];
    };
    erp?: ErpConfig;
};

/**
 * Erp provider
 */
export const provideErp = (
    config: ErpProviderConfig
): Array<Provider | EnvironmentProviders> => {
    // Base providers
    const providers: Array<Provider | EnvironmentProviders> = [
        {
            // Disable 'theme' sanity check
            provide: MATERIAL_SANITY_CHECKS,
            useValue: {
                doctype: true,
                theme: false,
                version: true,
            },
        },
        {
            // Use the 'fill' appearance on Angular Material form fields by default
            provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: {
                appearance: 'fill',
            },
        },
        {
            provide: ERP_MOCK_API_DEFAULT_DELAY,
            useValue: config?.mockApi?.delay ?? 0,
        },
        {
            provide: ERP_CONFIG,
            useValue: config?.erp ?? {},
        },

        importProvidersFrom(MatDialogModule),
        provideEnvironmentInitializer(() => inject(ErpConfirmationService)),

        provideHttpClient(withInterceptors([erpLoadingInterceptor])),
        provideEnvironmentInitializer(() => inject(ErpLoadingService)),

        provideEnvironmentInitializer(() => inject(ErpMediaWatcherService)),
        provideEnvironmentInitializer(() => inject(ErpPlatformService)),
        provideEnvironmentInitializer(() => inject(ErpSplashScreenService)),
        provideEnvironmentInitializer(() => inject(ErpUtilsService)),
    ];

    // Mock Api services
    if (config?.mockApi?.services) {
        providers.push(
            provideHttpClient(withInterceptors([mockApiInterceptor])),
            {
                provide: APP_INITIALIZER,
                deps: [...config.mockApi.services],
                useFactory: () => (): any => null,
                multi: true,
            }
        );
    }

    // Return the providers
    return providers;
};
