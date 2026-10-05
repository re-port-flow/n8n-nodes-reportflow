# n8n-nodes-reportflow

This is an n8n community node for [ReportFlow](https://re-port-flow.com) — a PDF generation API that creates PDFs from templates.

[ReportFlow](https://re-port-flow.com) is a PDF form generation API. Design templates in the visual editor, then generate PDFs via API by passing parameters.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Compatibility

Requires n8n 1.85.0 or later. From v0.1.11 the node uses `NodeConnectionTypes` from `n8n-workflow`, which first ships in n8n-workflow 1.83.0 (bundled with n8n 1.85.0). On older n8n versions, use n8n-nodes-reportflow v0.1.10, the last release that does not depend on it.

## Credentials

This node supports two authentication methods:

### AppKey Authentication
1. Go to your ReportFlow workspace settings → API Keys
2. Copy your **AppKey**
3. In n8n, create a new **ReportFlow AppKey API** credential and paste it

### OAuth2 (Client Credentials)
1. Register an OAuth2 client in your ReportFlow workspace
2. In n8n, create a new **ReportFlow OAuth2 API** credential
3. Enter your **Client ID** and **Client Secret**
4. Leave the scope at its default, `pdf:generate`. That is the only scope this
   node needs: every endpoint it calls lives under content-service `/v1/file/*`,
   whose guard checks for `pdf:generate` and nothing else. Requesting scopes the
   node does not use only widens what the connection is authorized to do.

## Operations

### PDF
| Operation | Description |
|-----------|-------------|
| **Generate (Sync)** | Generate a single PDF synchronously. Returns the PDF binary. |
| **Generate (Async)** | Generate a single PDF asynchronously. Returns `requestId`, `url` (the output list page in the Re:port Flow app) and `files` (with `fileId`). |
| **Generate Multiple (Sync)** | Generate multiple PDFs as a ZIP file. |
| **Generate Multiple (Async)** | Generate multiple PDFs asynchronously. |
| **Download** | Download a previously generated file by its `requestId` (16-character ID, not a UUID) and optional `fileId`. |

### Template
| Operation | Description |
|-----------|-------------|
| **Get Parameters** | Retrieve the parameter structure of a template. |

## Usage

### Basic PDF Generation
1. Add the **ReportFlow** node to your workflow
2. Select **PDF** → **Generate (Sync)**
3. Enter your **Template ID** — a 16-character alphanumeric ID such as `0eUDdgAjNXrrItA2` (not a UUID). It appears in the template URL of the Re:port Flow app (`…/templates/<Template ID>/…`).
4. Set the **Version** number
5. Provide a **File Name** (e.g., `invoice.pdf`). The `.pdf` extension is optional: the API stores the file as `<name>.pdf` either way and never doubles it (`invoice` and `invoice.pdf` both produce `invoice.pdf`). The node passes the value as-is to its binary output, so include `.pdf` if a later node (e.g. an email attachment) needs the extension. Not allowed: `/ \ : * ? " < > |` and control characters.
6. Enter the **Parameters** as JSON matching your template

### Getting Template Parameters
Use **Template** → **Get Parameters** first to see what parameters your template expects, then pass those to the PDF generation operation.

## Resources

* [ReportFlow API Documentation](https://doc.re-port-flow.com)
* [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
* [Postman Collection](https://www.postman.com/mone-pla/reportflow)

## License

[MIT](LICENSE)
