import type { IAuthenticateGeneric, ICredentialType, INodeProperties } from 'n8n-workflow';

export class ReportFlowAppKeyApi implements ICredentialType {
	name = 'reportFlowAppKeyApi';
	displayName = 'ReportFlow AppKey API';
	documentationUrl = 'https://doc.re-port-flow.com';
	properties: INodeProperties[] = [
		{
			displayName: 'App Key',
			name: 'appKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Your ReportFlow App Key. Found in Workspace Settings → API Keys.',
		},
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{
					name: 'Production',
					value: 'production',
				},
				{
					name: 'Staging',
					value: 'staging',
				},
			],
			default: 'production',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				appkey: '={{$credentials.appKey}}',
			},
		},
	};
}
