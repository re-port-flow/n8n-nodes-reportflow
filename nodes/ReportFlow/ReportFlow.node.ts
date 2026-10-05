import type {
	IDataObject,
	IExecuteFunctions,
	INode,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

function parseFileMapping(hdrs: Record<string, string>): unknown[] {
	try {
		const raw = hdrs['x-file-mapping'];
		return raw ? (JSON.parse(decodeURIComponent(raw)) as unknown[]) : [];
	} catch {
		return [];
	}
}

function parseContents(node: INode, raw: string | object[], itemIndex: number): object[] {
	if (typeof raw !== 'string') return raw;
	try {
		return JSON.parse(raw) as object[];
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Unknown error';
		throw new NodeOperationError(node, `Invalid JSON in "Contents (JSON Array)": ${msg}`, {
			itemIndex,
		});
	}
}

function isHttpError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const e = error as { response?: unknown; statusCode?: unknown; httpCode?: unknown; cause?: { response?: unknown; statusCode?: unknown } };
	return Boolean(e.response || e.statusCode || e.httpCode || e.cause?.response || e.cause?.statusCode);
}

export class ReportFlow implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ReportFlow',
		name: 'reportFlow',
		icon: 'file:reportflow.svg',
		group: ['output'],
		version: 1,
		// The stored resource values (pdf / design) stay unchanged for compatibility with
		// existing workflows. The canvas shows the display names (PDF / Template) instead of
		// the stored values; any value not in the mapping is shown as stored.
		subtitle:
			'={{($parameter["resource"] === "design" ? "Template" : $parameter["resource"] === "pdf" ? "PDF" : $parameter["resource"]) + ": " + $parameter["operation"]}}',
		description: 'Stop re-entering the same data into every document. Connect your workflow data to Re:port Flow templates and generate invoices, contracts, and reports as PDFs automatically.',
		documentationUrl: 'https://lp.re-port-flow.com',
		defaults: {
			name: 'ReportFlow',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'reportFlowAppKeyApi',
				required: true,
			},
		],
		properties: [
			// ---- Resource ----
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'PDF',
						value: 'pdf',
						description: 'Generate PDFs from templates',
					},
					{
						name: 'Template',
						value: 'design',
						description: 'Get template parameter schema',
					},
				],
				default: 'pdf',
			},
			// ---- PDF Operations ----
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['pdf'],
					},
				},
				options: [
					{
						name: 'Download',
						value: 'download',
						description: 'Download a generated file by requestId (and optional fileId)',
						action: 'Download a generated file',
					},
					{
						name: 'Generate (Async)',
						value: 'asyncSingle',
						description: 'Request a single PDF asynchronously and get requestId and file info',
						action: 'Generate a single PDF asynchronously',
					},
					{
						name: 'Generate (Sync)',
						value: 'syncSingle',
						description: 'Generate a single PDF synchronously and return the binary',
						action: 'Generate a single PDF synchronously',
					},
					{
						name: 'Generate Multiple (Async)',
						value: 'asyncMultiple',
						description: 'Request multiple PDFs asynchronously and get requestId and file info',
						action: 'Generate multiple PDF files asynchronously',
					},
					{
						name: 'Generate Multiple (Sync)',
						value: 'syncMultiple',
						description: 'Generate multiple PDFs synchronously and return a ZIP binary',
						action: 'Generate multiple PDF files synchronously as a zip',
					},
				],
				default: 'syncSingle',
			},
			// ---- Design Operations ----
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['design'],
					},
				},
				options: [
					{
						name: 'Get Parameters',
						value: 'getParameters',
						description: 'Get the parameter schema of a template',
						action: 'Get template parameters',
					},
				],
				default: 'getParameters',
			},
			// ---- Common: designId + version ----
			{
				displayName: 'Template ID',
				name: 'designId',
				type: 'string',
				required: true,
				default: '',
				placeholder: '0eUDdgAjNXrrItA2',
				description: 'ID of the template: a 16-character alphanumeric string such as 0eUDdgAjNXrrItA2 (not a UUID). It appears in the template URL of the Re:port Flow app (…/templates/&lt;Template ID&gt;/…).',
				displayOptions: {
					show: {
						operation: ['syncSingle', 'asyncSingle', 'syncMultiple', 'asyncMultiple', 'getParameters'],
					},
				},
			},
			{
				displayName: 'Version',
				name: 'version',
				type: 'number',
				required: true,
				default: 1,
				description: 'Version number of the template',
				displayOptions: {
					show: {
						operation: ['syncSingle', 'asyncSingle', 'syncMultiple', 'asyncMultiple'],
					},
				},
			},
			{
				displayName: 'Version',
				name: 'version',
				type: 'number',
				default: 0,
				description: 'Version number of the template. Leave as 0 to use the latest version.',
				displayOptions: {
					show: {
						operation: ['getParameters'],
					},
				},
			},
			// ---- Single PDF: content fields ----
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'invoice_001.pdf',
				// The value is sent to the API as-is and also used as-is for the binary output file name.
				// The API strips one trailing .pdf before storing and appends .pdf to the download name,
				// so the extension is optional and is never doubled.
				description: 'Output file name. The .pdf extension is optional: the API stores the file as &lt;name&gt;.pdf either way and never doubles it. This node also uses the value as-is for its binary output, so include .pdf if a later node (e.g. an email attachment) needs the extension. Not allowed: / \\ : * ? " &lt; &gt; | and control characters.',
				displayOptions: {
					show: {
						operation: ['syncSingle', 'asyncSingle'],
					},
				},
			},
			{
				displayName: 'Share Type',
				name: 'shareType',
				type: 'options',
				options: [
					{ name: 'Workspace', value: '01' },
					{ name: 'Invited', value: '02' },
					{ name: 'Public', value: '03' },
				],
				default: '01',
				description: 'Access control for the generated PDF',
				displayOptions: {
					show: {
						operation: ['syncSingle', 'asyncSingle'],
					},
				},
			},
			{
				displayName: 'Passcode Enabled',
				name: 'passcodeEnabled',
				type: 'boolean',
				default: false,
				description: 'Whether to protect the PDF with a passcode',
				displayOptions: {
					show: {
						operation: ['syncSingle', 'asyncSingle'],
					},
				},
			},
			{
				displayName: 'Parameters (JSON)',
				name: 'params',
				type: 'json',
				required: true,
				default: '{}',
				description: 'Template parameters as a JSON object. Use "Get Parameters" on the Template resource to see the expected structure.',
				displayOptions: {
					show: {
						operation: ['syncSingle', 'asyncSingle'],
					},
				},
			},
			{
				displayName: 'Passthrough (JSON)',
				name: 'passthrough',
				type: 'json',
				default: '{}',
				description: 'Arbitrary metadata echoed back in X-File-Mapping (sync) or files[].passthrough (async). Useful for correlating generated files with source records.',
				displayOptions: {
					show: {
						operation: ['syncSingle', 'asyncSingle'],
					},
				},
			},
			// ---- Multiple PDF fields ----
			{
				displayName: 'Contents (JSON Array)',
				name: 'contents',
				type: 'json',
				required: true,
				default: '[{"fileName": "file1", "shareType": "01", "passcodeEnabled": false, "params": {}}]',
				description: 'Array of content objects (max 100). Each element: { fileName (.pdf optional; must be unique, case-insensitive), params, shareType ("01"=Workspace / "02"=Invited / "03"=Public), passcodeEnabled?, passthrough? }.',
				displayOptions: {
					show: {
						operation: ['syncMultiple', 'asyncMultiple'],
					},
				},
			},
			// ---- Download fields ----
			{
				displayName: 'Request ID',
				name: 'requestId',
				type: 'string',
				required: true,
				default: '',
				description: 'The requestId (16-character ID, not a UUID) returned by a previous generation: the requestId of Generate (Async) / Generate Multiple (Async), or the requestId output of the sync operations',
				displayOptions: {
					show: {
						operation: ['download'],
					},
				},
			},
			{
				displayName: 'File ID',
				name: 'fileId',
				type: 'string',
				default: '',
				description: 'The file ID (16-character ID) for single-file download. Leave empty to download the full ZIP.',
				displayOptions: {
					show: {
						operation: ['download'],
					},
				},
			},
		],
		usableAsTool: true,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials('reportFlowAppKeyApi', i);
				const baseUrl = credentials.environment === 'staging'
					? 'https://api.stg.re-port-flow.com/v1'
					: 'https://api.re-port-flow.com/v1';

				const headers: Record<string, string> = {
					'Content-Type': 'application/json',
				};

				if (resource === 'design' && operation === 'getParameters') {
					const designId = this.getNodeParameter('designId', i) as string;
					const version = this.getNodeParameter('version', i, 0) as number;

					const url = version > 0
						? `${baseUrl}/file/design/parameter/${designId}?version=${version}`
						: `${baseUrl}/file/design/parameter/${designId}`;

					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'reportFlowAppKeyApi', {
						method: 'GET',
						url,
						headers,
						json: true,
					});

					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });

				} else if (resource === 'pdf') {

					if (operation === 'syncSingle') {
						const designId = this.getNodeParameter('designId', i) as string;
						const version = this.getNodeParameter('version', i) as number;
						const fileName = this.getNodeParameter('fileName', i) as string;
						const shareType = this.getNodeParameter('shareType', i, '01') as string;
						const passcodeEnabled = this.getNodeParameter('passcodeEnabled', i, false) as boolean;
						const params = this.getNodeParameter('params', i) as object;
						const passthrough = this.getNodeParameter('passthrough', i, {}) as object;

						const content: Record<string, unknown> = {
							fileName,
							shareType,
							passcodeEnabled,
							params,
						};
						if (passthrough && Object.keys(passthrough).length > 0) {
							content.passthrough = passthrough;
						}

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'reportFlowAppKeyApi', {
							method: 'POST',
							url: `${baseUrl}/file/sync/single`,
							headers,
							body: JSON.stringify({ designId, version, content }),
							returnFullResponse: true,
							encoding: 'arraybuffer',
						});

						const hdrs = response.headers as Record<string, string>;
						const fileUrl = hdrs['file-url'] ?? '';
						const requestId = hdrs['request-id'] ?? '';
						const fileMapping = parseFileMapping(hdrs);

						const binaryData = await this.helpers.prepareBinaryData(
							Buffer.from(response.body as ArrayBuffer),
							fileName,
							'application/pdf',
						);

						returnData.push({
							json: { fileName, requestId, fileUrl, fileMapping },
							binary: { data: binaryData },
							pairedItem: { item: i },
						});

					} else if (operation === 'asyncSingle') {
						const designId = this.getNodeParameter('designId', i) as string;
						const version = this.getNodeParameter('version', i) as number;
						const fileName = this.getNodeParameter('fileName', i) as string;
						const shareType = this.getNodeParameter('shareType', i, '01') as string;
						const passcodeEnabled = this.getNodeParameter('passcodeEnabled', i, false) as boolean;
						const params = this.getNodeParameter('params', i) as object;
						const passthrough = this.getNodeParameter('passthrough', i, {}) as object;
						const content: Record<string, unknown> = {
							fileName,
							shareType,
							passcodeEnabled,
							params,
						};
						if (passthrough && Object.keys(passthrough).length > 0) {
							content.passthrough = passthrough;
						}

						const body: Record<string, unknown> = { designId, version, content };

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'reportFlowAppKeyApi', {
							method: 'POST',
							url: `${baseUrl}/file/async/single`,
							headers,
							body,
							json: true,
						});

						returnData.push({ json: response as IDataObject, pairedItem: { item: i } });

					} else if (operation === 'syncMultiple') {
						const designId = this.getNodeParameter('designId', i) as string;
						const version = this.getNodeParameter('version', i) as number;
						const contentsRaw = this.getNodeParameter('contents', i) as string | object[];
						const contents = parseContents(this.getNode(), contentsRaw, i);

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'reportFlowAppKeyApi', {
							method: 'POST',
							url: `${baseUrl}/file/sync/multiple`,
							headers,
							body: JSON.stringify({ designId, version, contents }),
							returnFullResponse: true,
							encoding: 'arraybuffer',
						});

						const hdrs = response.headers as Record<string, string>;
						const requestId = hdrs['request-id'] ?? '';
						const fileUrl = hdrs['file-url'] ?? '';
						const fileMapping = parseFileMapping(hdrs);

						const binaryData = await this.helpers.prepareBinaryData(
							Buffer.from(response.body as ArrayBuffer),
							'output.zip',
							'application/zip',
						);

						returnData.push({
							json: { requestId, fileUrl, fileMapping },
							binary: { data: binaryData },
							pairedItem: { item: i },
						});

					} else if (operation === 'asyncMultiple') {
						const designId = this.getNodeParameter('designId', i) as string;
						const version = this.getNodeParameter('version', i) as number;
						const contentsRaw = this.getNodeParameter('contents', i) as string | object[];
						const contents = parseContents(this.getNode(), contentsRaw, i);
						const body: Record<string, unknown> = { designId, version, contents };

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'reportFlowAppKeyApi', {
							method: 'POST',
							url: `${baseUrl}/file/async/multiple`,
							headers,
							body,
							json: true,
						});

						returnData.push({ json: response as IDataObject, pairedItem: { item: i } });

					} else if (operation === 'download') {
						const requestId = this.getNodeParameter('requestId', i) as string;
						const fileId = this.getNodeParameter('fileId', i, '') as string;

						const downloadPath = fileId
							? `/file/download/${requestId}/${fileId}`
							: `/file/download/${requestId}`;

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'reportFlowAppKeyApi', {
							method: 'GET',
							url: `${baseUrl}${downloadPath}`,
							headers,
							returnFullResponse: true,
							encoding: 'arraybuffer',
						});

						const contentDisposition = (response.headers as Record<string, string>)['content-disposition'] ?? '';
						const contentType = (response.headers as Record<string, string>)['content-type'] ?? 'application/octet-stream';
						const fileNameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
						const downloadFileName = fileNameMatch?.[1] ?? (fileId ? 'download.pdf' : 'download.zip');

						const binaryData = await this.helpers.prepareBinaryData(
							Buffer.from(response.body as ArrayBuffer),
							downloadFileName,
							contentType,
						);

						returnData.push({
							json: { requestId, fileId, fileName: downloadFileName },
							binary: { data: binaryData },
							pairedItem: { item: i },
						});
					}
				}
			} catch (error) {
				const errObj = error as { cause?: { response?: { body?: unknown }; body?: unknown } };
				const apiBody = (errObj.cause?.response?.body ?? errObj.cause?.body) as IDataObject | string | undefined;
				if (this.continueOnFail()) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					returnData.push({
						json: { error: errorMessage, apiBody: apiBody ?? null },
						pairedItem: { item: i },
					});
					continue;
				}
				if (isHttpError(error)) {
					throw new NodeApiError(this.getNode(), error as JsonObject, {
						itemIndex: i,
						description: apiBody ? JSON.stringify(apiBody) : undefined,
					});
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}
