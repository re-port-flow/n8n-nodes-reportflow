import { ReportFlowAppKeyApi } from './ReportFlowAppKeyApi.credentials';
import { ReportFlowOAuth2Api } from './ReportFlowOAuth2Api.credentials';

describe('ReportFlowAppKeyApi credential', () => {
  const cred = new ReportFlowAppKeyApi();

  it('declares the reportFlowAppKeyApi name and display name', () => {
    expect(cred.name).toBe('reportFlowAppKeyApi');
    expect(cred.displayName).toBe('ReportFlow AppKey API');
  });

  it('exposes an appKey (password) and an environment selector', () => {
    const appKey = cred.properties.find((p) => p.name === 'appKey');
    expect(appKey?.type).toBe('string');
    expect(appKey?.typeOptions?.password).toBe(true);

    const env = cred.properties.find((p) => p.name === 'environment');
    expect(env?.default).toBe('production');
    expect(env?.options).toEqual([
      { name: 'Production', value: 'production' },
      { name: 'Staging', value: 'staging' },
    ]);
  });

  it('sends the app key via the appkey header', () => {
    expect(cred.authenticate.type).toBe('generic');
    expect(cred.authenticate.properties.headers).toEqual({
      appkey: '={{$credentials.appKey}}',
    });
  });
});

describe('ReportFlowOAuth2Api credential', () => {
  const cred = new ReportFlowOAuth2Api();

  it('extends oAuth2Api with the reportFlowOAuth2Api name', () => {
    expect(cred.name).toBe('reportFlowOAuth2Api');
    expect(cred.extends).toEqual(['oAuth2Api']);
  });

  it('pins the authorization-code grant against the ReportFlow endpoints', () => {
    const byName = (name: string) => cred.properties.find((p) => p.name === name);
    expect(byName('grantType')?.default).toBe('authorizationCode');
    expect(byName('authUrl')?.default).toBe(
      'https://re-port-flow.com/api/v1/oauth/authorize',
    );
    expect(byName('accessTokenUrl')?.default).toBe(
      'https://re-port-flow.com/api/v1/oauth/token',
    );
    expect(byName('scope')?.default).toBe('templates:read pdf:generate');
    expect(byName('authentication')?.default).toBe('body');
  });
});
