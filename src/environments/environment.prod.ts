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
    host: 'erp.boa.bo',
    baseUrl: 'pxp/lib/rest',
    mode: 'cors',
    port: location.protocol.replace(':', '') == 'https' ? '443' : '80',
    protocol: location.protocol.replace(':', ''),
    backendRestVersion: 1,
    initWebSocket: 'NO',
    portWs: '8010',
    serviceHost: 'http://172.17.45.86',//172.17.58.51
    filesUrl : location.protocol.replace(':', '')+'://erp.boa.bo/',
    //Credentiales Google
    client_id: '1018512937102-d41t4s69s6ccdb4o3mpceagorfhe48r8.apps.googleusercontent.com',
    client_secret: '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',
    client_fb: '660203996129020',
    backendVersion: 'v1',
    urlLogin: '',
    storeToken: false
};
