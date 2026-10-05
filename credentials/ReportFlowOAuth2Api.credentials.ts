import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

export class ReportFlowOAuth2Api implements ICredentialType {
	name = 'reportFlowOAuth2Api';
	extends = ['oAuth2Api'];
	displayName = 'ReportFlow OAuth2 API';
	icon: Icon = 'file:../nodes/ReportFlow/reportflow.svg';
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
			// Least privilege (PRJ-3-1522). This node only calls the content-service
			// `/v1/file/*` endpoints (sync/async single and multiple, design/parameter,
			// download), whose ApplicationGuard checks only `pdf:generate` on the JWT.
			// `templates:read` is neither declared nor checked by reposts-api or
			// content-service, so it was removed: keeping it would let existing tokens
			// reach any future endpoint that starts requiring it, without re-consent.
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
