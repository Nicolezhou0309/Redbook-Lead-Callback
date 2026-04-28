/**
 * 与计划 3.5 一致：固定表名 + 38 个字段（字段名 = 小红书 data 键名）
 * Base 用 FieldType：Text=单/多行文本, Number=数字, DateTime=日期时间（建表时指定 DATE_TIME 格式）
 */
import { FieldType } from '@lark-base-open/js-sdk';

export const TABLE_NAME = '小红书线索';

export const XHS_FIELDS: { name: string; type: FieldType }[] = [
  { name: 'id', type: FieldType.Text },
  { name: 'type', type: FieldType.Text },
  { name: 'time', type: FieldType.DateTime },
  { name: 'red_id', type: FieldType.Text },
  { name: 'c_user_id', type: FieldType.Text },
  { name: 'nick_name', type: FieldType.Text },
  { name: 'area', type: FieldType.Text },
  { name: 'leads_tag', type: FieldType.Text },
  { name: 'phone_num', type: FieldType.Text },
  { name: 'wechat', type: FieldType.Text },
  { name: 'remark', type: FieldType.Text },
  { name: 'source', type: FieldType.Text },
  { name: 'ad_account', type: FieldType.Text },
  { name: 'info_status', type: FieldType.Text },
  { name: 'auto_recognize', type: FieldType.Text },
  { name: 'note_link', type: FieldType.Text },
  { name: 'campaign_id', type: FieldType.Text },
  { name: 'campaign_name', type: FieldType.Text },
  { name: 'unit_id', type: FieldType.Text },
  { name: 'unit_name', type: FieldType.Text },
  { name: 'creativity_id', type: FieldType.Text },
  { name: 'creativity_name', type: FieldType.Text },
  { name: 'msg_receive_name', type: FieldType.Text },
  { name: 'msg_receive_id', type: FieldType.Text },
  { name: 'link_id', type: FieldType.Text },
  { name: 'link_name', type: FieldType.Text },
  { name: 'customer_channel', type: FieldType.Text },
  { name: 'open_talk', type: FieldType.Text },
  { name: 'staff_name', type: FieldType.Text },
  { name: 'staff_labels', type: FieldType.Text },
  { name: 'staff_country', type: FieldType.Text },
  { name: 'staff_province', type: FieldType.Text },
  { name: 'staff_city', type: FieldType.Text },
  { name: 'ext_info', type: FieldType.Text },
  { name: 'wechat_copy', type: FieldType.Text },
  { name: 'msg_app_open', type: FieldType.Text },
  { name: 'room_id', type: FieldType.Text },
  { name: 'room_name', type: FieldType.Text },
];
