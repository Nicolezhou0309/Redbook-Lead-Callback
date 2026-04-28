/**
 * 小红书 Webhook 签名校验：X-Red-Signature = sha1=HMAC-SHA1(token, rawBody)
 */
import crypto from 'crypto';

export function verifySignature(rawBody, token, signatureHeader) {
  if (!signatureHeader || !token) return true; // 未配置则跳过
  const prefix = 'sha1=';
  if (!signatureHeader.startsWith(prefix)) return false;
  const expected = signatureHeader.slice(prefix.length);
  const hmac = crypto.createHmac('sha1', token);
  hmac.update(rawBody);
  const actual = hmac.digest('hex');
  return actual === expected;
}
