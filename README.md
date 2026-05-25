# API Bulk Runner & Smart Response Mapper - Batch 2

This package includes:

- `index.html` — standalone web application.
- `local-agent.js` — zero-dependency Node.js local agent for APIs that block browser CORS.
- `package.json` — optional Node start script.
- `api-proxy.php` — optional hosted PHP proxy for trusted/private use.

## Browser-only mode

Upload `index.html` as your ReaderNook Lab app page. Browser Direct mode works only when the target API allows CORS requests from your site.

## Local Agent mode

Use this when the API blocks browser requests or is available only from your computer/network.

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

## Security notes

- Do not run a local agent without token protection.
- Do not share the token publicly.
- Do not use the hosted PHP proxy for untrusted public users unless you add authentication, rate limits, logging controls, and abuse protection.
- Browser mode is safest for public free tools because API keys remain in the user's browser until they run a request.
