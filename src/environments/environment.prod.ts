/*export const environment = {
    production: true,
    host: 'nodeservices.boa.bo',
    baseUrl: 'api/erp-nd/Erp/doRequest',
    mode: 'cors',
    port: location.protocol.replace(':', '') == 'https' ? '443' : '80',
    protocol: location.protocol.replace(':', ''),
    backendRestVersion: 2,
    initWebSocket: 'NO',
    portWs: '8010',
    backendVersion: 'v1',
    urlLogin: '',
    storeToken: true,
    serviceHost: 'http://172.17.45.86',
    filesUrl : location.protocol.replace(':', '')+'://erp.boa.bo/'
};*/
export const environment = {
    production: true,
    host: '10.150.0.91',
    baseUrl: 'kerp/pxp/lib/rest',
    mode: 'cors',
    port: location.protocol.replace(':', '') == 'https' ? '443' : '80',
    protocol: location.protocol.replace(':', ''),
    backendRestVersion: 1,
    initWebSocket: 'NO',
    portWs: '8010',
    backendVersion: 'v1',
    urlLogin: '',
    storeToken: false,
    filesUrl: 'http://10.150.0.91/kerp/'
};
