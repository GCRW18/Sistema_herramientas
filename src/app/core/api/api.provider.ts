import {
    EnvironmentProviders,
    inject,
    provideEnvironmentInitializer,
    Provider,
} from '@angular/core';
import { ErpApiService } from './api.service';

export const provideErpApi = (): Array<Provider | EnvironmentProviders> =>
{
    return [
        provideEnvironmentInitializer(() => inject(ErpApiService))
    ];
};
