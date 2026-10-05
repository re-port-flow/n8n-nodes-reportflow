import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ReportFlowAppKeyApi implements ICredentialType {
	name = 'reportFlowAppKeyApi';
	displayName = 'ReportFlow AppKey API';
	icon: Icon = 'file:../nodes/ReportFlow/reportflow.svg';
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

	// GET /file/designs is guarded by the same ApplicationGuard as the generation endpoints
	// and only lists templates, so it verifies the App Key without generating anything.
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.environment === "staging" ? "https://api.stg.re-port-flow.com/v1" : "https://api.re-port-flow.com/v1"}}',
			url: '/file/designs',
			method: 'GET',
		},
	};
}
