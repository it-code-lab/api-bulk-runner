#!/usr/bin/env node
'use strict';

/**
 * API Bulk Runner - Local Agent
 * Zero-dependency Node.js proxy for APIs that block browser CORS.
 *
 * Requirements: Node.js 18+ because it uses the built-in fetch API.
 * Run: node local-agent.js
 * Optional env:
 *   PORT=8787
 *   HOST=127.0.0.1
 *   AGENT_TOKEN=your-fixed-token
 *   MAX_BODY_BYTES=10485760
 */

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const VERSION = '1.0.0';
const STARTED_AT = new Date().toISOString();
const AGENT_TOKEN = process.env.AGENT_TOKEN || crypto.randomBytes(18).toString('base64url');
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 10 * 1024 * 1024);
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 60000);

function sendJson(res, status, data) {
  const payload = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Local-Agent-Token',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

function sendOptions(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Local-Agent-Token',
    'Access-Control-Max-Age': '86400'
  });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', chunk => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error(`Request body too large. Limit is ${MAX_BODY_BYTES} bytes.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function validateToken(req) {
  const received = req.headers['x-local-agent-token'];
  if (!received || received !== AGENT_TOKEN) {
    const err = new Error('Invalid or missing X-Local-Agent-Token. Paste the token printed by the local agent into the web app.');
    err.status = 401;
    throw err;
  }
}

function normalizeTargetUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') throw new Error('Missing target url.');
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https URLs are supported.');
  return url.toString();
}

function normalizeMethod(method) {
  const value = String(method || 'GET').toUpperCase();
  const allowed = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
  if (!allowed.has(value)) throw new Error(`Unsupported method: ${value}`);
  return value;
}

function normalizeHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return out;
  for (const [key, value] of Object.entries(headers)) {
    if (!key) continue;
    const lower = key.toLowerCase();
    if (['host', 'connection', 'content-length'].includes(lower)) continue;
    out[key] = String(value ?? '');
  }
  return out;
}

async function forwardRequest(payload) {
  const method = normalizeMethod(payload.method);
  const targetUrl = normalizeTargetUrl(payload.url);
  const headers = normalizeHeaders(payload.headers);
  const timeoutMs = Math.max(1000, Math.min(Number(payload.timeoutMs || REQUEST_TIMEOUT_MS), 300000));
  const body = ['GET', 'HEAD'].includes(method) ? undefined : payload.body;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'follow',
      signal: controller.signal
    });
    const text = await response.text();
    const responseHeaders = {};
    response.headers.forEach((value, key) => { responseHeaders[key] = value; });
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: text,
      elapsedMs: Date.now() - started,
      targetUrl
    };
  } finally {
    clearTimeout(timer);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return sendOptions(res);

    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      validateToken(req);
      return sendJson(res, 200, {
        ok: true,
        name: 'ReaderNook API Bulk Runner Local Agent',
        version: VERSION,
        startedAt: STARTED_AT,
        endpoint: `http://${HOST}:${PORT}/request`
      });
    }

    if (req.method === 'POST' && requestUrl.pathname === '/request') {
      validateToken(req);
      const raw = await readBody(req);
      let payload;
      try { payload = JSON.parse(raw || '{}'); }
      catch { throw new Error('Invalid JSON body sent to local agent.'); }
      const result = await forwardRequest(payload);
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, {
      ok: false,
      error: 'Not found. Use GET /health or POST /request.'
    });
  } catch (err) {
    const status = err.status || (err.name === 'AbortError' ? 504 : 500);
    return sendJson(res, status, {
      ok: false,
      error: err.name === 'AbortError' ? 'Target API request timed out.' : err.message
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('ReaderNook API Bulk Runner Local Agent');
  console.log('--------------------------------------');
  console.log(`Endpoint : http://${HOST}:${PORT}/request`);
  console.log(`Health   : http://${HOST}:${PORT}/health`);
  console.log(`Token    : ${AGENT_TOKEN}`);
  console.log('');
  console.log('Paste the endpoint and token into the web app, then click Test Agent.');
  console.log('Keep this terminal open while running bulk requests.');
  console.log('');
});
