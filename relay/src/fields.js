/**
 * 与计划 3.5 一致：小红书 data 全部 38 个字段名（用于 1:1 写入 Base 同名列）
 */
export const XHS_DATA_FIELDS = [
  'id', 'type', 'time', 'red_id', 'c_user_id', 'nick_name', 'area', 'leads_tag',
  'phone_num', 'wechat', 'remark', 'source', 'ad_account', 'info_status', 'auto_recognize', 'note_link',
  'campaign_id', 'campaign_name', 'unit_id', 'unit_name', 'creativity_id', 'creativity_name',
  'msg_receive_name', 'msg_receive_id', 'link_id', 'link_name', 'customer_channel', 'open_talk',
  'staff_name', 'staff_labels', 'staff_country', 'staff_province', 'staff_city',
  'ext_info', 'wechat_copy', 'msg_app_open', 'room_id', 'room_name',
];

/**
 * 将小红书 data 对象转为 Base 批量创建记录所需的 fields 对象
 * - time: yyyy-MM-dd HH:mm:ss -> 毫秒时间戳（Base 日期时间列）
 * - staff_labels/ext_info: 对象/数组 -> JSON 字符串
 * - 数字/布尔: 转成字符串，避免 Base 文本列报 TextFieldConvFail
 */
export function dataToBaseFields(data) {
  const fields = {};
  for (const key of XHS_DATA_FIELDS) {
    let val = data[key];
    if (val === undefined || val === null) continue;
    if (key === 'time') {
      if (typeof val === 'string') {
        const ms = new Date(val.replace(' ', 'T') + '+08:00').getTime();
        if (!Number.isNaN(ms)) val = ms;
      }
    } else if (key === 'staff_labels' || key === 'ext_info') {
      val = typeof val === 'object' ? JSON.stringify(val) : String(val);
    } else if (typeof val === 'object') {
      val = JSON.stringify(val);
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      val = String(val);
    }
    fields[key] = val;
  }
  return fields;
}
