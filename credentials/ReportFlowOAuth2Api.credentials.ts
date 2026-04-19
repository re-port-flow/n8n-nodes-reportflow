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
			default: 'templates:read pdf:generate',
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
