/**
 * 租户配置持久化：SQLite，支持十万级租户
 * 单文件、按 tenant_id 索引、不常驻内存
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.TENANTS_DB_PATH || './data/tenants.db';

let db = null;

function ensureDb() {
  if (db) return db;
  const dir = path.dirname(path.resolve(process.cwd(), DB_PATH));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const fullPath = path.resolve(process.cwd(), DB_PATH);
  db = new Database(fullPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id TEXT PRIMARY KEY,
      app_token TEXT NOT NULL DEFAULT '',
      table_id TEXT NOT NULL DEFAULT '',
      personal_base_token TEXT NOT NULL DEFAULT '',
      xhs_token TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tenants_tenant_id ON tenants(tenant_id);
  `);
  return db;
}

export function getTenantFromStore(tenantId) {
  ensureDb();
  const row = db.prepare(
    'SELECT tenant_id, app_token, table_id, personal_base_token, xhs_token FROM tenants WHERE tenant_id = ?'
  ).get(tenantId);
  if (!row) return null;
  return {
    app_token: row.app_token,
    table_id: row.table_id,
    personal_base_token: row.personal_base_token,
    xhs_token: row.xhs_token || '',
  };
}

export function saveTenantToStore(tenantId, data) {
  if (!tenantId || typeof data !== 'object') return false;
  ensureDb();
  try {
    db.prepare(`
      INSERT INTO tenants (tenant_id, app_token, table_id, personal_base_token, xhs_token, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(tenant_id) DO UPDATE SET
        app_token = excluded.app_token,
        table_id = excluded.table_id,
        personal_base_token = excluded.personal_base_token,
        xhs_token = excluded.xhs_token,
        updated_at = datetime('now')
    `).run(
      tenantId,
      data.app_token ?? '',
      data.table_id ?? '',
      data.personal_base_token ?? '',
      data.xhs_token ?? ''
    );
    return true;
  } catch (e) {
    console.error('saveTenantToStore error:', e);
    return false;
  }
}

/** 仅用于测试或维护：关闭 DB 连接 */
export function closeStore() {
  if (db) {
    db.close();
    db = null;
  }
}
