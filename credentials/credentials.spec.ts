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
    // 最小権限へ縮小した（PRJ-3-1522）。本ノードが呼ぶのは content-service の
    // `/v1/file/*` だけで、その ApplicationGuard は JWT に対し `pdf:generate`
    // のみを検査する。`templates:read` は reposts-api・content-service の
    // どちらでも宣言・検査されておらず、認可に一切関与していなかった。
    expect(byName('scope')?.default).toBe('pdf:generate');
    expect(byName('authentication')?.default).toBe('body');
  });

  // 保持していると、将来それを要求する口が増えた時点で利用者の再同意なしに
  // 既存トークンが到達できてしまう。要求しないことを明示的に固定する。
  it.each(['designs:read', 'designs:write', 'templates:read', 'templates:write'])(
    '未使用スコープ %s を既定で要求しない',
    (scope) => {
      const scopeDefault = cred.properties.find((p) => p.name === 'scope')
        ?.default as string;

      expect(scopeDefault.split(' ')).not.toContain(scope);
    },
  );
});
