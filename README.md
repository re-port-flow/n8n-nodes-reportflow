# n8n-nodes-reportflow

This is an n8n community node for [ReportFlow](https://re-port-flow.com) — a PDF generation API that creates PDFs from design templates.

[ReportFlow](https://re-port-flow.com) is a PDF form generation API. Design templates in the visual editor, then generate PDFs via API by passing parameters.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

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
4. Configure the scopes you need (e.g., `templates:read pdf:generate`)

## Operations

### PDF
| Operation | Description |
|-----------|-------------|
| **Generate (Sync)** | Generate a single PDF synchronously. Returns the PDF binary. |
| **Generate (Async)** | Generate a single PDF asynchronously. Returns a download URL. |
| **Generate Multiple (Sync)** | Generate multiple PDFs as a ZIP file. |
| **Generate Multiple (Async)** | Generate multiple PDFs asynchronously. |
| **Download** | Download a previously generated file by request UUID. |

### Design
| Operation | Description |
|-----------|-------------|
| **Get Parameters** | Retrieve the parameter structure of a design template. |

## Usage

### Basic PDF Generation
1. Add the **ReportFlow** node to your workflow
2. Select **PDF** → **Generate (Sync)**
3. Enter your **Design ID** (UUID from the ReportFlow dashboard)
4. Set the **Version** number
5. Provide a **File Name** (e.g., `invoice.pdf`)
6. Enter the **Parameters** as JSON matching your design template

### Getting Design Parameters
Use **Design** → **Get Parameters** first to see what parameters your template expects, then pass those to the PDF generation operation.

## Resources

* [ReportFlow API Documentation](https://doc.re-port-flow.com)
* [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
* [Postman Collection](https://www.postman.com/mone-pla/reportflow)

## License

[MIT](LICENSE)
