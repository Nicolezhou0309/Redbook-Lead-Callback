/**
 * 小红书线索中继服务
 * POST /webhook/leads/:tenantId  接收小红书私信推送，写入飞书多维表格
 * POST /api/tenant  前端提交配置（app_token, table_id, personal_base_token），服务器自动保存
 */
import http from 'http';
import { getTenant, saveTenant } from './config.js';
import { dataToBaseFields } from './fields.js';
import { batchCreateRecords } from './base.js';

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url?.split('?')[0] || '';

  if (req.method === 'OPTIONS') {
    send(res, 204, '', { ...corsHeaders(), 'Content-Length': '0' });
    return;
  }

  // 前端提交配置：用户填写授权码后提交，服务器自动保存，无需管理员改 JSON
  if (req.method === 'POST' && urlPath === '/api/tenant') {
    let rawBody;
    try {
      rawBody = await readBody(req);
    } catch (e) {
      send(res, 400, { ok: false, error: '读取请求体失败' }, corsHeaders());
      return;
    }
    const rawStr = rawBody?.length ? rawBody.toString('utf8') : '';
    if (!rawStr.trim()) {
      send(res, 400, { ok: false, error: '请求体为空，请检查网络或重试' }, corsHeaders());
      return;
    }
    let data;
    try {
      data = JSON.parse(rawStr);
    } catch (e) {
      send(res, 400, { ok: false, error: '请求体无效（非合法 JSON）' }, corsHeaders());
      return;
    }
    if (data === null || typeof data !== 'object') {
      send(res, 400, { ok: false, error: '请求体须为 JSON 对象' }, corsHeaders());
      return;
    }
    const tenantId = data.tenant_id || data.app_token || 'default';
    if (!data.app_token || !data.table_id || !data.personal_base_token) {
      send(res, 400, { ok: false, error: '缺少 app_token、table_id 或 personal_base_token' }, corsHeaders());
      return;
    }
    const ok = saveTenant(tenantId, {
      app_token: data.app_token,
      table_id: data.table_id,
      personal_base_token: data.personal_base_token,
    });
    if (ok) {
      send(res, 200, { ok: true, message: '配置已保存', tenant_id: tenantId }, corsHeaders());
    } else {
      send(res, 500, { ok: false, error: '保存失败' }, corsHeaders());
    }
    return;
  }

  const match = urlPath.match(/^\/webhook\/leads\/([^/?#]+)/);
  if (!match || req.method !== 'POST') {
    send(res, 404, { error: 'Not Found' });
    return;
  }

  const tenantId = match[1];
  const tenant = getTenant(tenantId);
  if (!tenant?.app_token || !tenant?.personal_base_token || !tenant?.table_id) {
    send(res, 404, { error: '租户未配置或不存在', tenant_id: tenantId });
    return;
  }

  const rawBody = await readBody(req);

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    send(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const data = payload?.data;
  if (!data || typeof data !== 'object') {
    send(res, 400, { error: 'Missing or invalid data field' });
    return;
  }

  const fields = dataToBaseFields(data);
  if (Object.keys(fields).length === 0) {
    send(res, 200, { ok: true, message: 'No fields to write' });
    return;
  }

  try {
    await batchCreateRecords(
      tenant.app_token,
      tenant.table_id,
      tenant.personal_base_token,
      [fields]
    );
    send(res, 200, { ok: true });
  } catch (e) {
    console.error('Base write error:', e);
    send(res, 500, { error: '写入多维表格失败', message: e.message });
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Relay listening on http://0.0.0.0:${port}`);
  console.log(`Webhook: POST http://<host>:${port}/webhook/leads/<tenant_id>`);
});
