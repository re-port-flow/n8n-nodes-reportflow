import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { ReportFlow } from './ReportFlow.node';

type Params = Record<string, unknown>;

interface CtxOptions {
  params: Params;
  items?: INodeExecutionData[];
  credentials?: Record<string, unknown>;
  http: jest.Mock;
  continueOnFail?: boolean;
}

const makeCtx = (opts: CtxOptions): IExecuteFunctions => {
  const items = opts.items ?? [{ json: {} }];
  const ctx = {
    getInputData: () => items,
    getNodeParameter: (name: string, _index: number, fallback?: unknown) =>
      name in opts.params ? opts.params[name] : fallback,
    getCredentials: jest.fn(async () => opts.credentials ?? { environment: 'production' }),
    helpers: {
      httpRequestWithAuthentication: opts.http,
      prepareBinaryData: jest.fn(async (buf: Buffer, fileName: string, mimeType: string) => ({
        data: buf.toString('base64'),
        fileName,
        mimeType,
      })),
    },
    continueOnFail: () => opts.continueOnFail ?? false,
    getNode: () => ({ name: 'ReportFlow', type: 'reportFlow' }),
  };
  return ctx as unknown as IExecuteFunctions;
};

const run = (opts: CtxOptions) => new ReportFlow().execute.call(makeCtx(opts));

// TextEncoder always allocates a tight, standalone ArrayBuffer (byteOffset 0,
// exact length), avoiding Node's shared Buffer pool.
const arrayBufferOf = (s: string): ArrayBuffer =>
  new TextEncoder().encode(s).buffer as ArrayBuffer;

describe('ReportFlow node description', () => {
  it('declares the reportFlow node with pdf/design resources', () => {
    const node = new ReportFlow();
    expect(node.description.name).toBe('reportFlow');
    expect(node.description.credentials?.[0]).toEqual({
      name: 'reportFlowAppKeyApi',
      required: true,
    });
    const resource = node.description.properties.find((p) => p.name === 'resource');
    expect(resource?.default).toBe('pdf');
  });
});

describe('ReportFlow execute — design.getParameters', () => {
  it('builds a versioned URL when version > 0', async () => {
    const http = jest.fn().mockResolvedValue({ schema: {} });
    const result = await run({
      params: { resource: 'design', operation: 'getParameters', designId: 'd1', version: 3 },
      http,
    });
    const [, options] = http.mock.calls[0];
    expect(options.method).toBe('GET');
    expect(options.url).toBe(
      'https://api.re-port-flow.com/v1/file/design/parameter/d1?version=3',
    );
    expect(result[0][0].json).toEqual({ schema: {} });
  });

  it('omits the version query when version is 0 (latest)', async () => {
    const http = jest.fn().mockResolvedValue({ schema: {} });
    await run({
      params: { resource: 'design', operation: 'getParameters', designId: 'd1' },
      http,
    });
    expect(http.mock.calls[0][1].url).toBe(
      'https://api.re-port-flow.com/v1/file/design/parameter/d1',
    );
  });

  it('uses the staging base URL for staging credentials', async () => {
    const http = jest.fn().mockResolvedValue({});
    await run({
      params: { resource: 'design', operation: 'getParameters', designId: 'd1', version: 2 },
      credentials: { environment: 'staging' },
      http,
    });
    expect(http.mock.calls[0][1].url).toContain('https://api.stg.re-port-flow.com/v1');
  });
});

describe('ReportFlow execute — pdf.syncSingle', () => {
  const baseParams = {
    resource: 'pdf',
    operation: 'syncSingle',
    designId: 'd1',
    version: 1,
    fileName: 'invoice_001',
    shareType: '01',
    passcodeEnabled: false,
    params: { total: 1000 },
  };

  const syncResponse = (headers: Record<string, string>) => ({
    headers,
    body: arrayBufferOf('%PDF-1.7'),
  });

  it('returns json + pdf binary and parses x-file-mapping', async () => {
    const mapping = [{ fileName: 'invoice_001.pdf', fileId: 'f1' }];
    const http = jest.fn().mockResolvedValue(
      syncResponse({
        'file-url': 'https://files/x',
        'request-id': 'req-1',
        'x-file-mapping': encodeURIComponent(JSON.stringify(mapping)),
      }),
    );
    const result = await run({ params: { ...baseParams }, http });
    const out = result[0][0];
    expect(out.json).toEqual({
      fileName: 'invoice_001',
      requestId: 'req-1',
      fileUrl: 'https://files/x',
      fileMapping: mapping,
    });
    expect(out.binary?.data.mimeType).toBe('application/pdf');
    const [, options] = http.mock.calls[0];
    expect(options.url).toBe('https://api.re-port-flow.com/v1/file/sync/single');
    const sentBody = JSON.parse(options.body as string);
    expect(sentBody.content.passthrough).toBeUndefined();
  });

  it('includes passthrough in the request body when non-empty', async () => {
    const http = jest.fn().mockResolvedValue(syncResponse({}));
    await run({
      params: { ...baseParams, passthrough: { orderId: 'o1' } },
      http,
    });
    const sentBody = JSON.parse(http.mock.calls[0][1].body as string);
    expect(sentBody.content.passthrough).toEqual({ orderId: 'o1' });
  });

  it('falls back to an empty file mapping when the header is absent', async () => {
    const http = jest.fn().mockResolvedValue(syncResponse({}));
    const result = await run({ params: { ...baseParams }, http });
    expect(result[0][0].json.fileMapping).toEqual([]);
  });

  it('falls back to an empty file mapping when the header is malformed', async () => {
    const http = jest.fn().mockResolvedValue(
      syncResponse({ 'x-file-mapping': '%ZZ-not-valid-json' }),
    );
    const result = await run({ params: { ...baseParams }, http });
    expect(result[0][0].json.fileMapping).toEqual([]);
  });
});

describe('ReportFlow execute — pdf.asyncSingle', () => {
  it('POSTs to /file/async/single and returns the JSON response', async () => {
    const http = jest.fn().mockResolvedValue({ requestId: 'req-2' });
    const result = await run({
      params: {
        resource: 'pdf',
        operation: 'asyncSingle',
        designId: 'd1',
        version: 1,
        fileName: 'f',
        shareType: '02',
        passcodeEnabled: true,
        params: {},
        passthrough: { a: 1 },
      },
      http,
    });
    expect(http.mock.calls[0][1].url).toBe(
      'https://api.re-port-flow.com/v1/file/async/single',
    );
    expect(http.mock.calls[0][1].body.content.passthrough).toEqual({ a: 1 });
    expect(result[0][0].json).toEqual({ requestId: 'req-2' });
  });

  it('omits passthrough when empty', async () => {
    const http = jest.fn().mockResolvedValue({});
    await run({
      params: {
        resource: 'pdf',
        operation: 'asyncSingle',
        designId: 'd1',
        version: 1,
        fileName: 'f',
        params: {},
      },
      http,
    });
    expect(http.mock.calls[0][1].body.content.passthrough).toBeUndefined();
  });
});

describe('ReportFlow execute — pdf.syncMultiple', () => {
  it('parses a JSON-string contents param and returns a zip binary', async () => {
    const http = jest.fn().mockResolvedValue({
      headers: { 'request-id': 'req-3', 'file-url': 'u' },
      body: arrayBufferOf('PK'),
    });
    const result = await run({
      params: {
        resource: 'pdf',
        operation: 'syncMultiple',
        designId: 'd1',
        version: 1,
        contents: JSON.stringify([{ fileName: 'a', params: {} }]),
      },
      http,
    });
    expect(http.mock.calls[0][1].url).toBe(
      'https://api.re-port-flow.com/v1/file/sync/multiple',
    );
    expect(JSON.parse(http.mock.calls[0][1].body as string).contents).toHaveLength(1);
    expect(result[0][0].binary?.data.fileName).toBe('output.zip');
    expect(result[0][0].binary?.data.mimeType).toBe('application/zip');
  });

  it('accepts an already-parsed contents array', async () => {
    const http = jest.fn().mockResolvedValue({
      headers: {},
      body: arrayBufferOf('PK'),
    });
    await run({
      params: {
        resource: 'pdf',
        operation: 'syncMultiple',
        designId: 'd1',
        version: 1,
        contents: [{ fileName: 'a', params: {} }],
      },
      http,
    });
    expect(JSON.parse(http.mock.calls[0][1].body as string).contents).toHaveLength(1);
  });
});

describe('ReportFlow execute — pdf.asyncMultiple', () => {
  it('parses a JSON-string contents param', async () => {
    const http = jest.fn().mockResolvedValue({ requestId: 'req-4' });
    const result = await run({
      params: {
        resource: 'pdf',
        operation: 'asyncMultiple',
        designId: 'd1',
        version: 1,
        contents: JSON.stringify([{ fileName: 'a', params: {} }]),
      },
      http,
    });
    expect(http.mock.calls[0][1].url).toBe(
      'https://api.re-port-flow.com/v1/file/async/multiple',
    );
    expect(result[0][0].json).toEqual({ requestId: 'req-4' });
  });

  it('accepts an already-parsed contents array', async () => {
    const http = jest.fn().mockResolvedValue({});
    await run({
      params: {
        resource: 'pdf',
        operation: 'asyncMultiple',
        designId: 'd1',
        version: 1,
        contents: [{ fileName: 'a', params: {} }],
      },
      http,
    });
    expect(http.mock.calls[0][1].body.contents).toHaveLength(1);
  });
});

describe('ReportFlow execute — contents JSON.parse failure (PRJ-3-714 #1)', () => {
  const invalidContents = '{not valid json';
  // The exact SyntaxError text varies across Node versions, so derive the
  // expected message from the same JSON.parse call the node performs. The node
  // wraps that message with a "Contents (JSON Array)" prefix (see parseContents).
  const expectedParseError = (() => {
    try {
      JSON.parse(invalidContents);
      return 'JSON.parse unexpectedly succeeded';
    } catch (e) {
      return `Invalid JSON in "Contents (JSON Array)": ${(e as Error).message}`;
    }
  })();

  const paramsFor = (operation: 'syncMultiple' | 'asyncMultiple'): Params => ({
    resource: 'pdf',
    operation,
    designId: 'd1',
    version: 1,
    contents: invalidContents,
  });

  it.each(['syncMultiple', 'asyncMultiple'] as const)(
    '%s: captures the parse error as data when continueOnFail is true',
    async (operation) => {
      const http = jest.fn();
      const result = await run({ params: paramsFor(operation), http, continueOnFail: true });
      expect(result[0][0].json).toEqual({ error: expectedParseError, apiBody: null });
      expect(result[0][0].pairedItem).toEqual({ item: 0 });
      expect(http).not.toHaveBeenCalled();
    },
  );

  it.each(['syncMultiple', 'asyncMultiple'] as const)(
    '%s: rethrows the parse error as NodeOperationError when continueOnFail is false',
    async (operation) => {
      const http = jest.fn();
      const promise = run({ params: paramsFor(operation), http });
      await expect(promise).rejects.toBeInstanceOf(NodeOperationError);
      await expect(promise).rejects.toMatchObject({ message: expectedParseError });
      expect(http).not.toHaveBeenCalled();
    },
  );
});

describe('ReportFlow execute — full request payload (PRJ-3-714 #2)', () => {
  it('syncSingle: sends the complete body with all content fields', async () => {
    const http = jest.fn().mockResolvedValue({ headers: {}, body: arrayBufferOf('%PDF-1.7') });
    await run({
      params: {
        resource: 'pdf',
        operation: 'syncSingle',
        designId: 'design-sync-1',
        version: 4,
        fileName: 'invoice_001',
        shareType: '02',
        passcodeEnabled: true,
        params: { total: 1000, customer: 'ACME' },
        passthrough: { orderId: 'o1' },
      },
      http,
    });
    expect(JSON.parse(http.mock.calls[0][1].body as string)).toEqual({
      designId: 'design-sync-1',
      version: 4,
      content: {
        fileName: 'invoice_001',
        shareType: '02',
        passcodeEnabled: true,
        params: { total: 1000, customer: 'ACME' },
        passthrough: { orderId: 'o1' },
      },
    });
  });

  it('asyncSingle: sends the complete body with all content fields', async () => {
    const http = jest.fn().mockResolvedValue({ requestId: 'req-a' });
    await run({
      params: {
        resource: 'pdf',
        operation: 'asyncSingle',
        designId: 'design-async-1',
        version: 2,
        fileName: 'contract_009',
        shareType: '03',
        passcodeEnabled: false,
        params: { name: 'Bob' },
      },
      http,
    });
    expect(http.mock.calls[0][1].body).toEqual({
      designId: 'design-async-1',
      version: 2,
      content: {
        fileName: 'contract_009',
        shareType: '03',
        passcodeEnabled: false,
        params: { name: 'Bob' },
      },
    });
  });

  it('syncMultiple: sends the complete body with designId, version, and contents', async () => {
    const contents = [
      { fileName: 'a.pdf', shareType: '01', passcodeEnabled: false, params: { n: 1 } },
      { fileName: 'b.pdf', shareType: '02', passcodeEnabled: true, params: { n: 2 } },
    ];
    const http = jest.fn().mockResolvedValue({ headers: {}, body: arrayBufferOf('PK') });
    await run({
      params: {
        resource: 'pdf',
        operation: 'syncMultiple',
        designId: 'design-multi-1',
        version: 7,
        contents: JSON.stringify(contents),
      },
      http,
    });
    expect(JSON.parse(http.mock.calls[0][1].body as string)).toEqual({
      designId: 'design-multi-1',
      version: 7,
      contents,
    });
  });

  it('asyncMultiple: sends the complete body with designId, version, and contents', async () => {
    const contents = [
      { fileName: 'c.pdf', shareType: '03', passcodeEnabled: false, params: { x: 'y' } },
    ];
    const http = jest.fn().mockResolvedValue({ requestId: 'req-b' });
    await run({
      params: {
        resource: 'pdf',
        operation: 'asyncMultiple',
        designId: 'design-multi-2',
        version: 5,
        contents,
      },
      http,
    });
    expect(http.mock.calls[0][1].body).toEqual({
      designId: 'design-multi-2',
      version: 5,
      contents,
    });
  });
});

describe('ReportFlow execute — binary content and multi-item loop (PRJ-3-714 #3)', () => {
  it('syncSingle: passes the exact response bytes to prepareBinaryData', async () => {
    const http = jest.fn().mockResolvedValue({ headers: {}, body: arrayBufferOf('%PDF-1.7') });
    const result = await run({
      params: {
        resource: 'pdf',
        operation: 'syncSingle',
        designId: 'd1',
        version: 1,
        fileName: 'invoice_001',
        params: {},
      },
      http,
    });
    expect(result[0][0].binary?.data.data).toBe(
      Buffer.from('%PDF-1.7').toString('base64'),
    );
  });

  it('processes two input items, mixing a success and a continueOnFail error', async () => {
    const http = jest
      .fn()
      .mockResolvedValueOnce({ requestId: 'req-ok' })
      .mockRejectedValueOnce(new Error('boom'));
    const result = await run({
      params: {
        resource: 'pdf',
        operation: 'asyncSingle',
        designId: 'd1',
        version: 1,
        fileName: 'f',
        params: {},
      },
      items: [{ json: { row: 1 } }, { json: { row: 2 } }],
      http,
      continueOnFail: true,
    });
    expect(http).toHaveBeenCalledTimes(2);
    expect(result[0]).toHaveLength(2);
    expect(result[0][0].json).toEqual({ requestId: 'req-ok' });
    expect(result[0][1].json).toEqual({ error: 'boom', apiBody: null });
    expect(result[0][1].pairedItem).toEqual({ item: 1 });
  });
});

describe('ReportFlow execute — pdf.download', () => {
  it('downloads a single file by fileId using the content-disposition name', async () => {
    const http = jest.fn().mockResolvedValue({
      headers: {
        'content-disposition': 'attachment; filename="invoice.pdf"',
        'content-type': 'application/pdf',
      },
      body: arrayBufferOf('%PDF'),
    });
    const result = await run({
      params: { resource: 'pdf', operation: 'download', requestId: 'req-5', fileId: 'f1' },
      http,
    });
    expect(http.mock.calls[0][1].url).toBe(
      'https://api.re-port-flow.com/v1/file/download/req-5/f1',
    );
    expect(result[0][0].json).toEqual({
      requestId: 'req-5',
      fileId: 'f1',
      fileName: 'invoice.pdf',
    });
    expect(result[0][0].binary?.data.mimeType).toBe('application/pdf');
  });

  it('downloads the full zip when no fileId is given (fallback name)', async () => {
    const http = jest.fn().mockResolvedValue({ headers: {}, body: arrayBufferOf('PK') });
    const result = await run({
      params: { resource: 'pdf', operation: 'download', requestId: 'req-6' },
      http,
    });
    expect(http.mock.calls[0][1].url).toBe(
      'https://api.re-port-flow.com/v1/file/download/req-6',
    );
    expect(result[0][0].json.fileName).toBe('download.zip');
    expect(result[0][0].binary?.data.mimeType).toBe('application/octet-stream');
  });

  it('uses the download.pdf fallback name for a fileId with no content-disposition', async () => {
    const http = jest.fn().mockResolvedValue({ headers: {}, body: arrayBufferOf('%PDF') });
    const result = await run({
      params: { resource: 'pdf', operation: 'download', requestId: 'req-7', fileId: 'f2' },
      http,
    });
    expect(result[0][0].json.fileName).toBe('download.pdf');
  });
});

describe('ReportFlow execute — unrouted resource/operation', () => {
  it('produces no output for an unknown pdf operation', async () => {
    const http = jest.fn();
    const result = await run({
      params: { resource: 'pdf', operation: 'nope' },
      http,
    });
    expect(result[0]).toEqual([]);
    expect(http).not.toHaveBeenCalled();
  });

  it('produces no output for an unknown resource', async () => {
    const http = jest.fn();
    const result = await run({
      params: { resource: 'other', operation: 'getParameters' },
      http,
    });
    expect(result[0]).toEqual([]);
  });
});

describe('ReportFlow execute — error handling', () => {
  it('rethrows as NodeOperationError when continueOnFail is false', async () => {
    const http = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(
      run({
        params: { resource: 'design', operation: 'getParameters', designId: 'd1' },
        http,
      }),
    ).rejects.toBeInstanceOf(NodeOperationError);
  });

  it('captures the error as data when continueOnFail is true', async () => {
    const http = jest.fn().mockRejectedValue(new Error('boom'));
    const result = await run({
      params: { resource: 'design', operation: 'getParameters', designId: 'd1' },
      http,
      continueOnFail: true,
    });
    expect(result[0][0].json).toEqual({ error: 'boom', apiBody: null });
    expect(result[0][0].pairedItem).toEqual({ item: 0 });
  });

  it('surfaces cause.response.body as apiBody', async () => {
    const err = Object.assign(new Error('http 400'), {
      cause: { response: { body: { message: 'bad request' } } },
    });
    const http = jest.fn().mockRejectedValue(err);
    const result = await run({
      params: { resource: 'design', operation: 'getParameters', designId: 'd1' },
      http,
      continueOnFail: true,
    });
    expect(result[0][0].json.apiBody).toEqual({ message: 'bad request' });
  });

  it('falls back to cause.body as apiBody', async () => {
    const err = Object.assign(new Error('http 500'), {
      cause: { body: 'server error' },
    });
    const http = jest.fn().mockRejectedValue(err);
    const result = await run({
      params: { resource: 'design', operation: 'getParameters', designId: 'd1' },
      http,
      continueOnFail: true,
    });
    expect(result[0][0].json.apiBody).toBe('server error');
  });

  it('reports "Unknown error" when a non-Error value is thrown', async () => {
    const http = jest.fn().mockRejectedValue('kaput');
    const result = await run({
      params: { resource: 'design', operation: 'getParameters', designId: 'd1' },
      http,
      continueOnFail: true,
    });
    expect(result[0][0].json).toEqual({ error: 'Unknown error', apiBody: null });
  });

  it('attaches the apiBody description on the thrown NodeOperationError', async () => {
    const err = Object.assign(new Error('http 400'), {
      cause: { response: { body: { message: 'bad' } } },
    });
    const http = jest.fn().mockRejectedValue(err);
    await expect(
      run({
        params: { resource: 'design', operation: 'getParameters', designId: 'd1' },
        http,
      }),
    ).rejects.toMatchObject({ description: JSON.stringify({ message: 'bad' }) });
  });
});

describe('ReportFlow execute — HTTP vs operation error classification (main merge)', () => {
  const baseParams = { resource: 'design', operation: 'getParameters', designId: 'd1' };

  it('throws NodeApiError when the error carries a top-level response', async () => {
    const err = Object.assign(new Error('http 400'), { response: { statusCode: 400 } });
    const http = jest.fn().mockRejectedValue(err);
    await expect(run({ params: baseParams, http })).rejects.toBeInstanceOf(NodeApiError);
  });

  it('throws NodeApiError for a statusCode-only error that carries no api body', async () => {
    const err = Object.assign(new Error('http 500'), { statusCode: 500 });
    const http = jest.fn().mockRejectedValue(err);
    await expect(run({ params: baseParams, http })).rejects.toBeInstanceOf(NodeApiError);
  });

  it('classifies httpCode-only errors as HTTP errors', async () => {
    const err = Object.assign(new Error('rate limited'), { httpCode: '429' });
    const http = jest.fn().mockRejectedValue(err);
    await expect(run({ params: baseParams, http })).rejects.toBeInstanceOf(NodeApiError);
  });

  it('classifies cause.statusCode errors as HTTP errors', async () => {
    const err = Object.assign(new Error('unavailable'), { cause: { statusCode: 503 } });
    const http = jest.fn().mockRejectedValue(err);
    await expect(run({ params: baseParams, http })).rejects.toBeInstanceOf(NodeApiError);
  });

  it('falls back to NodeOperationError for non-object throwables', async () => {
    const http = jest.fn().mockRejectedValue('kaput');
    await expect(run({ params: baseParams, http })).rejects.toBeInstanceOf(NodeOperationError);
  });
});

describe('ReportFlow execute — parseContents non-Error guard (main merge)', () => {
  it('reports "Unknown error" when JSON.parse throws a non-Error value', async () => {
    const spy = jest.spyOn(JSON, 'parse').mockImplementation(() => {
      throw 'weird';
    });
    try {
      const http = jest.fn();
      const result = await run({
        params: { resource: 'pdf', operation: 'syncMultiple', designId: 'd1', version: 1, contents: '[]' },
        http,
        continueOnFail: true,
      });
      expect(result[0][0].json).toEqual({
        error: 'Invalid JSON in "Contents (JSON Array)": Unknown error',
        apiBody: null,
      });
      expect(http).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
