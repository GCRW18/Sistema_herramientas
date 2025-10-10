export const environment = {
    production: false,
    host: '10.150.0.91',
    baseUrl: 'kerp_ismael/pxp/lib/rest',
    mode: 'cors',
    port: location.protocol.replace(':', '') == 'https' ? '443' : '80',
    protocol: location.protocol.replace(':', ''),
    backendRestVersion: 1,
    initWebSocket: 'NO',
    portWs: '8010',
    backendVersion: 'v1',
    urlLogin: '',
    storeToken: false,
    filesUrl : 'http://10.150.0.91/kerp/'
};
