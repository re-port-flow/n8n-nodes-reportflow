import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class ReportFlowOAuth2Api implements ICredentialType {
	name = 'reportFlowOAuth2Api';
	extends = ['oAuth2Api'];
	displayName = 'ReportFlow OAuth2 API';
	documentationUrl = 'https://doc.re-port-flow.com';
	properties: INodeProperties[] = [
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: 'https://re-port-flow.com/api/v1/oauth/authorize',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://re-port-flow.com/api/v1/oauth/token',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'string',
			// 最小権限（PRJ-3-1522）。本ノードが呼ぶのは content-service の
			// `/v1/file/*`（sync/async single・multiple / design/parameter /
			// download）だけで、その ApplicationGuard は JWT に対し
			// `pdf:generate` のみを検査する。
			// `templates:read` は reposts-api・content-service のどちらでも
			// 宣言・検査されておらず認可に無関与のため外した。保持したままだと
			// 将来これを要求する口が増えた時点で、再同意なしに既存トークンが
			// 到達できてしまう。
			default: 'pdf:generate',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
	];
}
