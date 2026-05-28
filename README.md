# API Bulk Runner & Smart Response Mapper - Batch 2

This package includes:

- `index.html` — standalone web application.
- `local-agent.js` — zero-dependency Node.js local agent for APIs that block browser CORS.
- `package.json` — optional Node start script.
- `api-proxy.php` — optional hosted PHP proxy for trusted/private use.
- `backend-examples/` — optional backend proxy examples for full/private builds, starting with Python FastAPI.

## Quick Start

For normal browser-only use, no installation is required.

1. Download or unzip this folder.
2. Open `index.html` in Chrome, Edge, Firefox, or Safari.
3. Start with Demo mode.
4. For real APIs, use Browser Direct mode with APIs that allow browser/CORS requests.

No Node.js, npm install, server, or database is required for the browser-only build.

## Application features

- Demo mode includes sample request/response scenarios for single-field and multi-field request mapping.
- Request variables can be mapped explicitly to parsed bulk input columns.
- Input columns can be edited in a table-style grid and pasted from spreadsheets.
- Response fields can be mapped to result columns from discovered JSON paths.
- Failed rows can be filtered and retried after a bulk run.
- Bulk run templates are stored locally in the browser.
- The template library can be exported/imported as JSON to move between systems.

## User Guide

See [`docs/user-guide.md`](docs/user-guide.md) for setup, usage, workflows, template handling, exports, privacy notes, and troubleshooting.

## Selling on Gumroad

See [`docs/gumroad-selling-guide.md`](docs/gumroad-selling-guide.md) for seller setup, product listing copy, buyer instructions, license-key configuration, and a launch checklist.

## Browser-only mode

Upload `index.html` as your ReaderNook Lab app page. Browser Direct mode works only when the target API allows CORS requests from your site.

Proxy / Local Agent mode is disabled in the browser-only build. To enable it for a backend/private product build, set `appConfig.enableProxyMode` to `true` in `index.html`.

## Optional Local Agent mode

Use this only for a backend/private build where Proxy / Local Agent mode is enabled. The browser-only build disables this mode by default.

Requirements: Node.js 18+

```bash
node local-agent.js
```

The terminal prints:

```text
Endpoint : http://127.0.0.1:8787/request
Token    : <generated-token>
```

In the app:

1. Choose **Proxy endpoint / Local Agent** mode.
2. Click **Use Local Agent Defaults**.
3. Paste the token printed by the terminal.
4. Click **Test Agent**.
5. Run test or bulk requests.

## Fixed token option

For repeat use, start the agent with a fixed token:

Windows PowerShell:

```powershell
$env:AGENT_TOKEN="paste-a-long-random-token-here"
node local-agent.js
```

Mac/Linux:

```bash
AGENT_TOKEN="paste-a-long-random-token-here" node local-agent.js
```

## Hosted PHP proxy mode

`api-proxy.php` is useful if you want a hosted proxy on your own server. Protect it carefully because API keys pass through that server.

Change this line before uploading:

```php
$PROXY_TOKEN = getenv('PROXY_TOKEN') ?: 'CHANGE_ME_TO_A_LONG_RANDOM_TOKEN';
```

Then use the PHP file URL as the app's proxy endpoint and paste the same token.

## Python FastAPI proxy mode

For a Python-based full/private product build, use:

```text
backend-examples/python-fastapi-proxy/
```

Quick start:

```bash
cd backend-examples/python-fastapi-proxy
python -m venv .venv
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8787
```

Set `PROXY_TOKEN` before starting the server, then use `http://127.0.0.1:8787/request` as the app's proxy endpoint. See [`backend-examples/python-fastapi-proxy/README.md`](backend-examples/python-fastapi-proxy/README.md) for the full setup.

## Security notes

- Do not run a local agent without token protection.
- Do not share the token publicly.
- Do not use the hosted PHP proxy for untrusted public users unless you add authentication, rate limits, logging controls, and abuse protection.
- Browser mode is safest for public free tools because API keys remain in the user's browser until they run a request.
