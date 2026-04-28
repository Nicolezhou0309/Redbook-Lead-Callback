/**
 * 本地联调测试：请求本地 relay，校验接口契约（消息发送 /api/tenant /webhook）
 * 使用方式：先启动服务 npm start，再在另一终端执行 node scripts/local-integration-test.js
 */
const BASE = process.env.RELAY_BASE_URL || 'http://127.0.0.1:3000';
const TENANT_ID = 'local-test-' + Date.now();

async function request(method, path, body = null) {
  const url = path.startsWith('http') ? path : `${BASE.replace(/\/$/, '')}${path}`;
  const opt = { method, headers: { 'Content-Type': 'application/json' } };
  if (body != null) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { status: res.status, json, text };
}

function ok(name, cond) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    return true;
  }
  console.log(`  ❌ ${name}`);
  return false;
}

async function run() {
  console.log('Relay 本地联调测试 @ ' + BASE + '\n');

  let passed = 0;
  let failed = 0;

  // 1. POST /api/tenant 缺少字段 -> 400
  const r1 = await request('POST', '/api/tenant', {});
  if (ok('POST /api/tenant 缺字段 → 400', r1.status === 400 && r1.json?.ok === false)) passed++; else failed++;

  // 2. POST /api/tenant 合法 body -> 200
  const r2 = await request('POST', '/api/tenant', {
    tenant_id: TENANT_ID,
    app_token: 'test_app_token',
    table_id: 'test_table_id',
    personal_base_token: 'test_personal_token',
  });
  if (ok('POST /api/tenant 合法 → 200', r2.status === 200 && r2.json?.ok === true)) passed++; else failed++;

  // 3. POST /webhook/leads/:id 无 data -> 400
  const r3 = await request('POST', `/webhook/leads/${TENANT_ID}`, {});
  if (ok('POST /webhook 无 data → 400', r3.status === 400)) passed++; else failed++;

  // 4. POST /webhook/leads/:id data 非对象 -> 400
  const r4 = await request('POST', `/webhook/leads/${TENANT_ID}`, { data: 123 });
  if (ok('POST /webhook data 非对象 → 400', r4.status === 400)) passed++; else failed++;

  // 5. POST /webhook/leads/:id 合法 data（空对象，不写 Base）-> 200（文档：200 即推送成功）
  const r5 = await request('POST', `/webhook/leads/${TENANT_ID}`, {
    data: {},
    timestamp: Math.floor(Date.now() / 1000),
    source: 'official',
  });
  if (ok('POST /webhook 合法 data（空）→ 200', r5.status === 200 && r5.json?.ok === true)) passed++; else failed++;

  // 6. 未知租户 -> 404
  const r6 = await request('POST', '/webhook/leads/nonexistent-tenant-xyz', { data: { id: '1' } });
  if (ok('POST /webhook 未知租户 → 404', r6.status === 404)) passed++; else failed++;

  // 7. GET / 或错误路径 -> 404
  const r7 = await request('GET', '/');
  if (ok('GET / → 404', r7.status === 404)) passed++; else failed++;

  console.log('\n' + (failed === 0 ? '全部通过' : `通过 ${passed}，失败 ${failed}`));
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('请求失败（请确认已启动 relay: npm start）', e.message);
  process.exit(1);
});
