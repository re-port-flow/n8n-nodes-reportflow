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

  it('declares the SVG icon shipped with the node', () => {
    expect(cred.icon).toBe('file:../nodes/ReportFlow/reportflow.svg');
  });

  // n8n community node review (0.1.10): a credential must define a test request.
  it('tests the key with GET /file/designs against the selected environment', () => {
    expect(cred.test.request.method).toBe('GET');
    expect(cred.test.request.url).toBe('/file/designs');
    const baseURL = cred.test.request.baseURL ?? '';
    expect(baseURL.startsWith('={{') && baseURL.endsWith('}}')).toBe(true);
    expect(baseURL).toContain('$credentials.environment === "staging"');
    expect(baseURL).toContain('"https://api.stg.re-port-flow.com/v1"');
    expect(baseURL).toContain('"https://api.re-port-flow.com/v1"');
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

  it('declares the SVG icon shipped with the node', () => {
    expect(cred.icon).toBe('file:../nodes/ReportFlow/reportflow.svg');
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
    // Reduced to least privilege (PRJ-3-1522). This node only calls the content-service
    // `/v1/file/*` endpoints, whose ApplicationGuard checks only `pdf:generate` on the JWT.
    // `templates:read` is neither declared nor checked by reposts-api or content-service
    // and played no part in authorization.
    expect(byName('scope')?.default).toBe('pdf:generate');
    expect(byName('authentication')?.default).toBe('body');
  });

  // Keeping them would let existing tokens reach any future endpoint that starts requiring
  // them, without the user's re-consent. Pin that they are not requested.
  it.each(['designs:read', 'designs:write', 'templates:read', 'templates:write'])(
    'does not request the unused scope %s by default',
    (scope) => {
      const scopeDefault = cred.properties.find((p) => p.name === 'scope')
        ?.default as string;

      expect(scopeDefault.split(' ')).not.toContain(scope);
    },
  );
});
