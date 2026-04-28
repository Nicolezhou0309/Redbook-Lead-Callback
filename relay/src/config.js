/**
 * 租户配置：仅 SQLite 存储，支持十万级租户；保留环境变量单租户兼容
 */
import { getTenantFromStore, saveTenantToStore } from './store.js';

/** 单租户时可由环境变量覆盖 */
function getEnvDefaultTenant() {
  if (
    process.env.BASE_APP_TOKEN &&
    process.env.BASE_PERSONAL_BASE_TOKEN &&
    process.env.BASE_TABLE_ID
  ) {
    return {
      app_token: process.env.BASE_APP_TOKEN,
      personal_base_token: process.env.BASE_PERSONAL_BASE_TOKEN,
      table_id: process.env.BASE_TABLE_ID,
      xhs_token: process.env.XHS_WEBHOOK_TOKEN || '',
    };
  }
  return null;
}

export function getTenant(tenantId) {
  const fromStore = getTenantFromStore(tenantId);
  if (fromStore?.app_token) return fromStore;
  if (tenantId === 'default') return getEnvDefaultTenant();
  return getTenantFromStore('default') || getEnvDefaultTenant();
}

export function saveTenant(tenantId, data) {
  return saveTenantToStore(tenantId, {
    app_token: data.app_token || '',
    personal_base_token: data.personal_base_token || '',
    table_id: data.table_id || '',
    xhs_token: data.xhs_token || '',
  });
}
