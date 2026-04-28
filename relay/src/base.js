/**
 * 调用飞书 Base 批量创建记录 API（base-api.feishu.cn + PersonalBaseToken）
 */
const BASE_API = 'https://base-api.feishu.cn';

export async function batchCreateRecords(appToken, tableId, personalBaseToken, records) {
  const url = `${BASE_API}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${personalBaseToken}`,
    },
    body: JSON.stringify({
      records: records.map((fields) => ({ fields })),
    }),
  });
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(json.msg || `Base API error: ${json.code}`);
  }
  return json.data;
}
