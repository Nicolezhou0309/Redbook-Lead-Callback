import './App.css';
import { bitable, FieldType, DateFormatter } from "@lark-base-open/js-sdk";
import { Button, Typography, Card, Space, Spin, Form, Input } from '@douyinfe/semi-ui';
import { useState, useCallback, useEffect } from 'react';
import { TABLE_NAME, XHS_FIELDS } from './xhsLeadsFields';

/** 中继服务地址。嵌入飞书等 HTTPS 页面时必须是 HTTPS，否则会被浏览器拦截（Mixed Content） */
const RELAY_BASE_URL = import.meta.env.VITE_RELAY_BASE_URL || 'https://lark.nicole.xin';
const REQUIRED_FIELD_NAMES = XHS_FIELDS.map((f) => f.name);

/** 将接口/ SDK 返回的英文错误转为中文提示 */
function getErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();
  if (lower.includes('table name repeated') || lower.includes('table name duplicate') || lower.includes('表名重复') || lower.includes('1254013')) {
    return `表名「${TABLE_NAME}」已存在，请先删除或重命名该表后再创建。`;
  }
  if (lower.includes('field name') && (lower.includes('duplicate') || lower.includes('repeated') || lower.includes('重复'))) {
    return '字段名已存在，请检查当前表是否已包含同名字段。';
  }
  if (lower.includes('permission') || lower.includes('forbidden') || lower.includes('无权限') || lower.includes('403')) {
    return '无操作权限，请确认您有编辑当前多维表格的权限。';
  }
  if (lower.includes('network') || lower.includes('timeout') || lower.includes('fetch') || lower.includes('网络')) {
    return '网络异常，请检查网络后重试。';
  }
  if (lower.includes('not found') || lower.includes('404')) {
    return '未找到对应资源，请刷新页面后重试。';
  }
  return `操作失败：${raw}`;
}

/** 检测已存在的表并校验结构是否完整 */
async function checkExistingSyncTable(): Promise<{
  tableId: string;
  baseId: string;
  structureComplete: boolean;
  missingFields: string[];
} | null> {
  const base = bitable.base;
  const metaList = await base.getTableMetaList();
  const tableMeta = metaList.find((t) => t.name === TABLE_NAME);
  if (!tableMeta) return null;

  const table = await base.getTableById(tableMeta.id);
  const fieldMetaList = await table.getFieldMetaList();
  const existingNames = new Set((fieldMetaList as { name?: string }[]).map((f) => f.name).filter(Boolean));
  const missingFields = REQUIRED_FIELD_NAMES.filter((name) => !existingNames.has(name));
  const structureComplete = missingFields.length === 0;

  const selection = await base.getSelection();
  const baseId = selection.baseId || '';

  return {
    tableId: tableMeta.id,
    baseId,
    structureComplete,
    missingFields,
  };
}

export default function App() {
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(true);
  const [patching, setPatching] = useState(false);
  const [patchErr, setPatchErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ baseId: string; tableId: string } | null>(null);
  const [existingIncomplete, setExistingIncomplete] = useState<{ tableId: string; baseId: string; missingFields: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [personalToken, setPersonalToken] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const refreshCheck = useCallback(async () => {
    setChecking(true);
    setErr(null);
    setExistingIncomplete(null);
    setPatchErr(null);
    try {
      const existing = await checkExistingSyncTable();
      if (existing) {
        if (existing.structureComplete) {
          setResult({ baseId: existing.baseId, tableId: existing.tableId });
        } else {
          setExistingIncomplete({
            tableId: existing.tableId,
            baseId: existing.baseId,
            missingFields: existing.missingFields,
          });
        }
      } else {
        setResult(null);
      }
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setChecking(false);
    }
  }, []);

  /** 对已存在但结构不完整的表手动补全缺失字段（需点击按钮触发） */
  const patchMissingFields = useCallback(async (info: { tableId: string; baseId: string; missingFields: string[] }) => {
    setPatching(true);
    setPatchErr(null);
    setErr(null);
    try {
      const base = bitable.base;
      const table = await base.getTableById(info.tableId);
      const nameToField = new Map(XHS_FIELDS.map((f) => [f.name, f]));
      for (const name of info.missingFields) {
        const field = nameToField.get(name);
        if (!field) continue;
        const config = name === 'time' && field.type === FieldType.DateTime
          ? { type: field.type as number, name: field.name, property: { dateFormat: DateFormatter.DATE_TIME } }
          : { type: field.type as number, name: field.name };
        await table.addField(config);
      }
      setExistingIncomplete(null);
      await refreshCheck();
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      setPatchErr(msg);
    } finally {
      setPatching(false);
    }
  }, [refreshCheck]);

  useEffect(() => {
    refreshCheck();
  }, [refreshCheck]);

  const createSyncTable = useCallback(async () => {
    setCreating(true);
    setErr(null);
    setResult(null);
    try {
      const base = bitable.base;
      const { tableId } = await base.addTable({ name: TABLE_NAME } as any);
      const table = await base.getTableById(tableId);
      for (const { name, type } of XHS_FIELDS) {
        const config = name === 'time' && type === FieldType.DateTime
          ? { type: type as number, name, property: { dateFormat: DateFormatter.DATE_TIME } }
          : { type: type as number, name };
        await table.addField(config);
      }
      const selection = await base.getSelection();
      const baseId = selection.baseId || '';
      setResult({ baseId, tableId });
      setExistingIncomplete(null);
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }, []);

  const webhookUrl = result ? `${RELAY_BASE_URL.replace(/\/$/, '')}/webhook/leads/${result.baseId}` : '';

  // 步骤：1 创建表 2 提交授权码 3 复制 webhook 到小红书
  const step = !result ? 0 : submitStatus === 'ok' ? 2 : 1;

  const submitConfig = useCallback(async () => {
    if (!result?.baseId || !result?.tableId || !personalToken.trim()) return;
    setSubmitStatus('loading');
    setSubmitErr(null);
    const base = RELAY_BASE_URL.replace(/\/$/, '');
    const payload = {
      tenant_id: String(result.baseId),
      app_token: String(result.baseId),
      table_id: String(result.tableId),
      personal_base_token: personalToken.trim(),
    };
    const body = JSON.stringify(payload);
    const abort = new AbortController();
    const timeoutId = setTimeout(() => abort.abort(), 15000);
    try {
      const res = await fetch(`${base}/api/tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: abort.signal,
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      let json: { ok?: boolean; error?: string };
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        setSubmitStatus('err');
        setSubmitErr(res.ok ? '响应格式异常' : res.statusText || '提交失败');
        return;
      }
      if (res.ok && json.ok) {
        setSubmitStatus('ok');
      } else {
        setSubmitStatus('err');
        setSubmitErr(json.error || res.statusText || '提交失败');
      }
    } catch (e) {
      clearTimeout(timeoutId);
      setSubmitStatus('err');
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('abort')) {
        setSubmitErr('请求超时，请检查网络后重试');
      } else {
        setSubmitErr(
          /refused|failed to fetch|network/i.test(msg)
            ? '无法连接中继服务，请确认 lark.nicole.xin 上中继已启动且 Nginx 已代理 /api'
            : msg || '网络异常'
        );
      }
    }
  }, [result, personalToken]);

  if (checking) {
    return (
      <main className="xhs-plugin">
        <header className="xhs-plugin__header">
          <Typography.Title heading={5} className="xhs-plugin__title">
            小红书线索同步
          </Typography.Title>
          <span className="xhs-plugin__header-deco" aria-hidden>
            <svg width="230" height="180" viewBox="0 0 230 180" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="220" y="30" width="10" height="60" fill="#353535"/>
              <rect x="200" y="100" width="10" height="40" fill="#353535"/>
              <rect x="190" y="10" width="10" height="10" fill="#353535"/>
              <rect x="180" y="20" width="10" height="10" fill="#353535"/>
              <rect x="180" y="30" width="10" height="10" fill="#353535"/>
              <rect x="190" y="40" width="10" height="10" fill="#353535"/>
              <rect x="120" y="30" width="10" height="20" fill="#353535"/>
              <rect x="110" y="10" width="10" height="20" fill="#353535"/>
              <rect x="19.9995" y="10" width="10" height="20" fill="#353535"/>
              <rect x="9.99976" y="30" width="10" height="20" fill="#353535"/>
              <rect x="190" y="80.0001" width="10" height="20" fill="#353535"/>
              <rect x="200" y="50.0001" width="10" height="20" fill="#353535"/>
              <rect x="210" y="70.0001" width="10" height="30" transform="rotate(90 210 70.0001)" fill="#353535"/>
              <rect x="170" y="50.0001" width="10" height="40" transform="rotate(90 170 50.0001)" fill="#353535"/>
              <rect x="190" y="140" width="10" height="10" fill="#353535"/>
              <rect x="170" y="60" width="10" height="10" fill="#353535"/>
              <rect x="100" width="10" height="10" fill="#353535"/>
              <rect x="90.0002" y="10" width="10" height="10" fill="#353535"/>
              <rect x="40.0002" y="10" width="10" height="10" fill="#353535"/>
              <rect x="29.9998" y="60" width="10" height="10" fill="#353535"/>
              <rect x="59.9998" y="80" width="10" height="10" fill="#353535"/>
              <rect x="50" y="80" width="10" height="10" fill="#353535"/>
              <rect x="70.0002" y="80" width="10" height="10" fill="#353535"/>
              <rect x="90.0002" y="60" width="10" height="10" fill="#353535"/>
              <rect x="29.9998" width="10" height="10" fill="#353535"/>
              <rect x="50" y="20" width="40" height="10" fill="#353535"/>
              <rect x="180" y="150" width="10" height="10" fill="#353535"/>
              <rect x="29.9998" y="160" width="10" height="10" fill="#353535"/>
              <rect x="19.9995" y="150" width="10" height="10" fill="#353535"/>
              <rect x="19.9995" y="140" width="10" height="10" fill="#FF98F5"/>
              <rect x="29.9998" y="150" width="10" height="10" fill="#FF98F5"/>
              <rect x="10" y="100" width="10" height="10" fill="#FF98F5"/>
              <rect x="79.9998" y="150" width="10" height="10" fill="#FF98F5"/>
              <rect x="120" y="150" width="10" height="10" fill="#FF98F5"/>
              <rect x="170" y="150" width="10" height="10" fill="#FF98F5"/>
              <rect x="180" y="140" width="10" height="10" fill="#FF98F5"/>
              <rect x="190" y="130" width="10" height="10" fill="#FF98F5"/>
              <rect x="210" y="70.0001" width="10" height="10" fill="#FF98F5"/>
              <rect x="210" y="50.0001" width="10" height="10" fill="#FF98F5"/>
              <rect x="120" y="50.0001" width="10" height="10" fill="#FF98F5"/>
              <rect x="100" y="70.0001" width="10" height="10" fill="#FF98F5"/>
              <rect x="19.9995" y="70.0001" width="10" height="10" fill="#FF98F5"/>
              <rect x="110" y="30" width="10" height="10" fill="#FF98F5"/>
              <rect x="90.0002" y="20" width="10" height="10" fill="#FF98F5"/>
              <rect x="79.9998" y="30" width="10" height="10" fill="#FF98F5"/>
              <rect x="40.0002" y="20" width="10" height="10" fill="#FF98F5"/>
              <rect x="30" y="10" width="10" height="10" fill="#FF98F5"/>
              <rect x="100" y="10" width="10" height="10" fill="#FF98F5"/>
              <rect x="19.9995" y="30" width="10" height="10" fill="#FF98F5"/>
              <rect x="9.99976" y="50.0001" width="10" height="10" fill="#FF98F5"/>
              <rect x="150" y="60" width="10" height="20" fill="#FF98F5"/>
              <rect x="130" y="60" width="10" height="20" fill="#FF98F5"/>
              <rect x="50" y="150" width="20" height="10" fill="#FF98F5"/>
              <rect x="50" y="30" width="20" height="10" fill="#FF98F5"/>
              <rect x="140" y="150" width="20" height="10" fill="#FF98F5"/>
              <rect x="9.99976" y="140" width="10" height="10" fill="#353535"/>
              <rect x="19.9998" y="110" width="10" height="30" fill="#FF98F5"/>
              <rect y="50.0001" width="10" height="60" fill="#353535"/>
              <rect x="10" y="110" width="10" height="30" fill="#353535"/>
              <rect x="160" y="170" width="10" height="10" fill="#353535"/>
              <rect x="210" y="90" width="10" height="10" fill="#353535"/>
              <rect x="170" y="160" width="10" height="20" fill="#353535"/>
              <rect x="160" y="160" width="10" height="20" transform="rotate(90 160 160)" fill="#353535"/>
              <rect x="140" y="170" width="10" height="20" transform="rotate(90 140 170)" fill="#353535"/>
              <rect x="90.0002" y="170" width="10" height="20" transform="rotate(90 90.0002 170)" fill="#353535"/>
              <rect x="50" y="170" width="10" height="20" transform="rotate(90 50 170)" fill="#353535"/>
              <rect x="70.0002" y="160" width="10" height="20" transform="rotate(90 70.0002 160)" fill="#353535"/>
              <rect x="130" y="160" width="10" height="50" transform="rotate(90 130 160)" fill="#353535"/>
              <rect x="200" y="20" width="20" height="10" fill="#353535"/>
            </svg>
          </span>
        </header>
        <div className="xhs-plugin__action" style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Spin size="large" tip="正在检测同步表…" />
        </div>
      </main>
    );
  }

  return (
    <main className="xhs-plugin">
      <header className="xhs-plugin__header">
        <Typography.Title heading={5} className="xhs-plugin__title">
          小红书线索同步
        </Typography.Title>
        <span className="xhs-plugin__header-deco" aria-hidden>
          <svg width="230" height="180" viewBox="0 0 230 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="220" y="30" width="10" height="60" fill="#353535"/>
            <rect x="200" y="100" width="10" height="40" fill="#353535"/>
            <rect x="190" y="10" width="10" height="10" fill="#353535"/>
            <rect x="180" y="20" width="10" height="10" fill="#353535"/>
            <rect x="180" y="30" width="10" height="10" fill="#353535"/>
            <rect x="190" y="40" width="10" height="10" fill="#353535"/>
            <rect x="120" y="30" width="10" height="20" fill="#353535"/>
            <rect x="110" y="10" width="10" height="20" fill="#353535"/>
            <rect x="19.9995" y="10" width="10" height="20" fill="#353535"/>
            <rect x="9.99976" y="30" width="10" height="20" fill="#353535"/>
            <rect x="190" y="80.0001" width="10" height="20" fill="#353535"/>
            <rect x="200" y="50.0001" width="10" height="20" fill="#353535"/>
            <rect x="210" y="70.0001" width="10" height="30" transform="rotate(90 210 70.0001)" fill="#353535"/>
            <rect x="170" y="50.0001" width="10" height="40" transform="rotate(90 170 50.0001)" fill="#353535"/>
            <rect x="190" y="140" width="10" height="10" fill="#353535"/>
            <rect x="170" y="60" width="10" height="10" fill="#353535"/>
            <rect x="100" width="10" height="10" fill="#353535"/>
            <rect x="90.0002" y="10" width="10" height="10" fill="#353535"/>
            <rect x="40.0002" y="10" width="10" height="10" fill="#353535"/>
            <rect x="29.9998" y="60" width="10" height="10" fill="#353535"/>
            <rect x="59.9998" y="80" width="10" height="10" fill="#353535"/>
            <rect x="50" y="80" width="10" height="10" fill="#353535"/>
            <rect x="70.0002" y="80" width="10" height="10" fill="#353535"/>
            <rect x="90.0002" y="60" width="10" height="10" fill="#353535"/>
            <rect x="29.9998" width="10" height="10" fill="#353535"/>
            <rect x="50" y="20" width="40" height="10" fill="#353535"/>
            <rect x="180" y="150" width="10" height="10" fill="#353535"/>
            <rect x="29.9998" y="160" width="10" height="10" fill="#353535"/>
            <rect x="19.9995" y="150" width="10" height="10" fill="#353535"/>
            <rect x="19.9995" y="140" width="10" height="10" fill="#FF98F5"/>
            <rect x="29.9998" y="150" width="10" height="10" fill="#FF98F5"/>
            <rect x="10" y="100" width="10" height="10" fill="#FF98F5"/>
            <rect x="79.9998" y="150" width="10" height="10" fill="#FF98F5"/>
            <rect x="120" y="150" width="10" height="10" fill="#FF98F5"/>
            <rect x="170" y="150" width="10" height="10" fill="#FF98F5"/>
            <rect x="180" y="140" width="10" height="10" fill="#FF98F5"/>
            <rect x="190" y="130" width="10" height="10" fill="#FF98F5"/>
            <rect x="210" y="70.0001" width="10" height="10" fill="#FF98F5"/>
            <rect x="210" y="50.0001" width="10" height="10" fill="#FF98F5"/>
            <rect x="120" y="50.0001" width="10" height="10" fill="#FF98F5"/>
            <rect x="100" y="70.0001" width="10" height="10" fill="#FF98F5"/>
            <rect x="19.9995" y="70.0001" width="10" height="10" fill="#FF98F5"/>
            <rect x="110" y="30" width="10" height="10" fill="#FF98F5"/>
            <rect x="90.0002" y="20" width="10" height="10" fill="#FF98F5"/>
            <rect x="79.9998" y="30" width="10" height="10" fill="#FF98F5"/>
            <rect x="40.0002" y="20" width="10" height="10" fill="#FF98F5"/>
            <rect x="30" y="10" width="10" height="10" fill="#FF98F5"/>
            <rect x="100" y="10" width="10" height="10" fill="#FF98F5"/>
            <rect x="19.9995" y="30" width="10" height="10" fill="#FF98F5"/>
            <rect x="9.99976" y="50.0001" width="10" height="10" fill="#FF98F5"/>
            <rect x="150" y="60" width="10" height="20" fill="#FF98F5"/>
            <rect x="130" y="60" width="10" height="20" fill="#FF98F5"/>
            <rect x="50" y="150" width="20" height="10" fill="#FF98F5"/>
            <rect x="50" y="30" width="20" height="10" fill="#FF98F5"/>
            <rect x="140" y="150" width="20" height="10" fill="#FF98F5"/>
            <rect x="9.99976" y="140" width="10" height="10" fill="#353535"/>
            <rect x="19.9998" y="110" width="10" height="30" fill="#FF98F5"/>
            <rect y="50.0001" width="10" height="60" fill="#353535"/>
            <rect x="10" y="110" width="10" height="30" fill="#353535"/>
            <rect x="160" y="170" width="10" height="10" fill="#353535"/>
            <rect x="210" y="90" width="10" height="10" fill="#353535"/>
            <rect x="170" y="160" width="10" height="20" fill="#353535"/>
            <rect x="160" y="160" width="10" height="20" transform="rotate(90 160 160)" fill="#353535"/>
            <rect x="140" y="170" width="10" height="20" transform="rotate(90 140 170)" fill="#353535"/>
            <rect x="90.0002" y="170" width="10" height="20" transform="rotate(90 90.0002 170)" fill="#353535"/>
            <rect x="50" y="170" width="10" height="20" transform="rotate(90 50 170)" fill="#353535"/>
            <rect x="70.0002" y="160" width="10" height="20" transform="rotate(90 70.0002 160)" fill="#353535"/>
            <rect x="130" y="160" width="10" height="50" transform="rotate(90 130 160)" fill="#353535"/>
            <rect x="200" y="20" width="20" height="10" fill="#353535"/>
          </svg>
        </span>
      </header>

      <div className="xhs-plugin__steps">
        {/* 步骤 1：创建表 */}
        <div className={`xhs-plugin__step-item ${step === 0 ? 'xhs-plugin__step-item--current' : ''} ${step > 0 ? 'xhs-plugin__step-item--done' : ''}`}>
          <div className="xhs-plugin__step-header">
            <span className="xhs-plugin__step-num">{step > 0 ? '✓' : '1'}</span>
            <span className="xhs-plugin__step-title">创建表</span>
          </div>
          {step === 0 && (
            <div className="xhs-plugin__step-body">
              {existingIncomplete ? (
                <>
                  <Card className="xhs-plugin__card" bodyStyle={{ padding: '12px 16px' }}>
                    <Typography.Text strong style={{ color: '#000' }}>
                      表「{TABLE_NAME}」已存在，但结构不完整
                    </Typography.Text>
                    <Typography.Text type="secondary" size="small" style={{ display: 'block', marginTop: 8 }}>
                      缺少以下 {existingIncomplete.missingFields.length} 个字段（共需 {REQUIRED_FIELD_NAMES.length} 个）：
                    </Typography.Text>
                    <div className="xhs-plugin__mono" style={{ marginTop: 8, fontSize: 12, maxHeight: 120, overflow: 'auto' }}>
                      {existingIncomplete.missingFields.join('、')}
                    </div>
                    <Typography.Text type="tertiary" size="small" style={{ display: 'block', marginTop: 12 }}>
                      点击下方「补全缺失字段」将自动添加上述字段，无需删除表。
                    </Typography.Text>
                  </Card>
                  {patchErr && (
                    <Typography.Text type="danger" size="small" style={{ display: 'block', marginTop: 12 }}>
                      {patchErr}
                    </Typography.Text>
                  )}
                  <Button
                    theme="solid"
                    type="primary"
                    block
                    loading={patching}
                    disabled={patching}
                    onClick={() => patchMissingFields(existingIncomplete)}
                    style={{ marginTop: 12 }}
                  >
                    {patching ? '补全中…' : '补全缺失字段'}
                  </Button>
                </>
              ) : (
                <>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    在当前多维表格下创建固定表「{TABLE_NAME}」（{XHS_FIELDS.length} 个字段）。
                  </Typography.Text>
                  <Button
                    theme="solid"
                    type="primary"
                    size="large"
                    loading={creating}
                    onClick={createSyncTable}
                    disabled={creating}
                    block
                  >
                    {creating ? '创建中…' : '创建同步表'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 步骤 2：提交授权码 */}
        <div className={`xhs-plugin__step-item ${step === 1 ? 'xhs-plugin__step-item--current' : ''} ${step > 1 ? 'xhs-plugin__step-item--done' : ''}`}>
          <div className="xhs-plugin__step-header">
            <span className="xhs-plugin__step-num">{step > 1 ? '✓' : '2'}</span>
            <span className="xhs-plugin__step-title">提交授权码</span>
          </div>
          {step === 1 && (
            <div className="xhs-plugin__step-body">
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                从多维表格「插件 → 自定义插件 → 获取授权码」中复制授权码。
              </Typography.Text>
              <Space vertical spacing="medium" style={{ width: '100%' }}>
                <Input
                  type="password"
                  value={personalToken}
                  onChange={(v) => setPersonalToken(v)}
                  placeholder="授权码"
                  style={{ width: '100%' }}
                />
                <Button
                  theme="solid"
                  type="primary"
                  block
                  loading={submitStatus === 'loading'}
                  onClick={submitConfig}
                  disabled={!personalToken.trim()}
                >
                  提交
                </Button>
                {submitStatus === 'err' && submitErr && (
                  <Typography.Text type="danger" size="small">{submitErr}</Typography.Text>
                )}
              </Space>
            </div>
          )}
        </div>

        {/* 步骤 3：复制 Webhook 地址到小红书 */}
        <div className={`xhs-plugin__step-item ${step === 2 ? 'xhs-plugin__step-item--current' : ''}`}>
          <div className="xhs-plugin__step-header">
            <span className="xhs-plugin__step-num">3</span>
            <span className="xhs-plugin__step-title">复制 Webhook 地址到小红书</span>
          </div>
          {step === 2 && (
            <div className="xhs-plugin__step-body">
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                将下方地址复制到小红书「私信 API 对接」中填写的消息接收地址，即可接收线索推送。
              </Typography.Text>
              <Card className="xhs-plugin__card" bodyStyle={{ padding: '12px 16px', textAlign: 'left' }}>
                <Typography.Paragraph copyable={{ content: webhookUrl }} className="xhs-plugin__url-wrap">
                  <span className="xhs-plugin__url">{webhookUrl}</span>
                </Typography.Paragraph>
              </Card>
              <Button block theme="borderless" type="tertiary" onClick={refreshCheck} style={{ marginTop: 8 }}>
                重新检测表结构
              </Button>
            </div>
          )}
        </div>
      </div>

      {err && (
        <div className="xhs-plugin__err">
          <Typography.Text type="danger">{err}</Typography.Text>
        </div>
      )}

      <footer className="xhs-plugin__author">
        <Card className="xhs-plugin__author-card" bodyStyle={{ padding: 0 }}>
          <div className="xhs-plugin__author-inner">
            <div className="xhs-plugin__author-avatar" aria-hidden>
              <img src={`${import.meta.env.BASE_URL}profile.jpg`} alt="小咪获客笔记" />
            </div>
            <div className="xhs-plugin__author-info">
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 8 }}>
                <Typography.Text strong className="xhs-plugin__author-name">
                  小咪碎碎念
                </Typography.Text>
                <Typography.Text type="secondary" size="small" className="xhs-plugin__author-desc xhs-plugin__author-xhs">
                  <svg className="xhs-plugin__xhs-icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden><path d="M960 797.248V226.784C960 137.248 886.752 64 797.216 64H226.784C137.248 64 64 137.248 64 226.784v570.464c0 88.64 71.808 161.344 160.16 162.752h575.68c88.32-1.408 160.16-74.08 160.16-162.752" fill="#FF2442"/><path d="M700.544 384h50.4v18.048c0 1.44 0.704 2.112 2.08 2.08 29.888-0.896 60 0.064 75.424 30.72 9.184 18.176 7.296 45.824 6.784 67.52-0.032 1.28 0.576 1.984 1.792 2.112 3.52 0.32 6.944 0.64 10.272 1.056 59.424 7.136 47.68 63.168 47.872 107.2 0.096 15.36-1.632 26.592-5.12 33.76-7.36 14.848-20.544 23.36-39.552 25.472H813.44l-18.944-43.968a1.44 1.44 0 0 1 0.096-1.344 1.376 1.376 0 0 1 1.152-0.64l40.192-0.032c2.24 0 4.352-0.96 5.888-2.624a8.896 8.896 0 0 0 2.368-6.176c-0.192-13.44-0.288-26.848-0.224-40.256 0-12.064-5.696-18.24-17.184-18.56-12.992-0.32-37.6-0.32-73.856 0.064-1.28 0-1.92 0.704-1.92 2.08l-0.192 111.456H700.48l-0.16-111.936a1.984 1.984 0 0 0-1.952-2.048h-47.04a2.24 2.24 0 0 1-2.176-2.24l0.064-48.704c0-1.632 0.768-2.464 2.304-2.464l46.496 0.096a2.208 2.208 0 0 0 1.6-0.704 2.432 2.432 0 0 0 0.64-1.664v-42.112a2.784 2.784 0 0 0-2.688-2.848l-28.704 0.128c-1.504 0-2.24-0.8-2.24-2.368l-0.096-48.96c0-1.44 0.64-2.144 2.08-2.144h29.728c1.28 0 1.92-0.64 1.92-2.016l0.32-17.984z m52.192 120.736l31.264-0.064c0.512 0 0.992-0.224 1.344-0.608a2.016 2.016 0 0 0 0.544-1.408l-0.16-39.136c0-3.072-2.24-5.568-4.96-5.568l-25.088 0.064a4.704 4.704 0 0 0-3.52 1.664 5.984 5.984 0 0 0-1.44 4l0.16 39.136c0 1.088 0.864 1.92 1.856 1.92zM429.344 508.256c-12.16 0.224-34.144 3.616-38.944-12.032-2.912-9.344 3.68-22.368 7.68-31.488 11.392-25.952 22.56-52 33.536-78.144 0.448-1.056 1.216-1.6 2.304-1.6h48.096c0.416 0 0.768 0.224 0.96 0.576a1.28 1.28 0 0 1 0.128 1.152l-27.84 65.056c-0.64 1.504-0.48 3.2 0.352 4.608a4.544 4.544 0 0 0 3.84 2.176h41.216c0.512 0 0.96 0.256 1.248 0.672 0.256 0.448 0.32 0.96 0.096 1.44-11.904 27.744-23.776 55.296-35.616 82.656-1.184 2.72-1.696 4.736-1.504 6.016 0.416 2.784 1.984 4.192 4.672 4.224l26.08 0.16c1.504 0.032 1.984 0.768 1.376 2.24l-16.864 39.68a3.328 3.328 0 0 1-3.2 2.208c-26.496 0.32-45.024 0.32-55.584-0.16-17.472-0.8-21.76-16.096-14.976-31.872l23.968-55.936a1.216 1.216 0 0 0-0.096-1.088 1.088 1.088 0 0 0-0.96-0.544zM229.504 671.968h-18.88l-18.496-43.424a1.408 1.408 0 0 1 0.096-1.312 1.28 1.28 0 0 1 1.088-0.64l26.112-0.064a6.112 6.112 0 0 0 5.984-6.24l0.704-230.304a2.24 2.24 0 0 1 2.208-2.304h44.928c2.112 0 3.168 1.12 3.2 3.328 0.192 77.984 0.192 154.624 0 229.952-0.128 30.912-14.464 52.032-46.944 51.008z" fill="#FFFFFF"/><path d="M650.944 671.968h-170.432l22.848-51.52a3.04 3.04 0 0 1 2.976-1.952l41.728 0.064c1.472 0 2.24-0.736 2.24-2.24v-156.32c0-1.344-0.64-2.016-1.92-2.016l-27.68-0.032c-1.248 0-2.24-1.088-2.24-2.4v-50.144c0-0.768 0.576-1.408 1.312-1.408h112.832c1.408 0 2.08 0.736 2.08 2.208l0.064 49.6c0 1.44-0.704 2.176-2.112 2.176h-27.904c-1.28 0-1.92 0.672-1.92 2.016v156.224c0 1.504 0.736 2.24 2.144 2.24l44.224 0.096c1.216 0 1.824 0.64 1.824 1.92L650.944 672zM853.92 408.864c34.816-23.936 59.328 37.088 21.184 47.552-6.208 1.728-16.096 1.824-29.632 0.32-1.216-0.128-1.792-0.8-1.792-2.08-0.192-14.4-3.04-36.672 10.24-45.76zM373.312 588.288l-23.04 53.664c-2.08 4.8-4.352 4.896-6.88 0.384-16.96-30.656-22.72-55.68-26.048-93.792-2.56-29.6-4.768-59.2-6.688-88.864-0.064-1.344 0.544-2.016 1.824-2.016l46.688 0.032c1.312 0 2.048 0.704 2.144 2.048 2.4 34.496 4.928 68.896 7.552 103.2 0.672 8.832 2.176 16.16 4.48 21.984a4.16 4.16 0 0 1-0.032 3.36zM128 586.304v-2.208a22.592 22.592 0 0 0 4.16-10.112c3.456-38.08 6.272-76.128 8.48-114.208 0.096-1.184 0.672-1.792 1.792-1.792h47.68c0.416 0 0.832 0.192 1.152 0.544 0.288 0.32 0.448 0.768 0.416 1.216a6351.04 6351.04 0 0 1-8.416 105.184c-2.24 25.44-10.368 59.488-27.36 80.128-1.088 1.312-2.016 1.184-2.72-0.416L128 586.304zM453.184 671.968h-69.056l-8.8-3.488c-1.248-0.48-1.6-1.344-1.024-2.592l21.664-49.6c0.64-1.44 1.664-1.984 3.136-1.6 23.68 6.432 51.104 3.776 75.328 3.872 1.504 0.032 1.92 0.768 1.28 2.176l-22.528 51.2z" fill="#FFFFFF"/></svg>
                  小红书：小咪获客笔记
                </Typography.Text>
              </div>
              <Typography.Text type="secondary" size="small" className="xhs-plugin__author-desc">
                以前手动整理小红书私信线索，每天复制粘贴，很烦！很烦！很烦！
                <br /><br />
                现在使用插件3分钟就能完成官网回传对接，配合飞书的自动化功能，实现自动分配。
                <br /><br />
                如果你也在专注获客这件事，可以关注我，一起交流效率工具。
              </Typography.Text>
            </div>
          </div>
        </Card>
      </footer>
    </main>
  );
}
