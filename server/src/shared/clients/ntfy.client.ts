import { env } from '../../config/env.js';

export interface NtfyMessage {
  /** Tên topic trên ntfy. Rỗng = người dùng chưa cấu hình → không gửi. */
  topic: string;
  title: string;
  message: string;
  tags?: string[];
}

export type NtfySendResult =
  | { sent: true }
  | { sent: false; reason: 'no-topic' }
  | { sent: false; reason: 'network-error' }
  | { sent: false; reason: 'http-error'; status: number };

/** Bỏ cuộc sau ngần này. Nhắc nhở trễ vô ích, và cron phút sau lại chạy. */
const REQUEST_TIMEOUT_MS = 5_000;

// eslint-disable-next-line no-control-regex
const ASCII_ONLY = /^[\x00-\x7F]*$/;

/**
 * Header HTTP chỉ mang được ASCII. Tiêu đề tiếng Việt phải bọc theo
 * encoded-word của RFC 2047 (`=?UTF-8?B?<base64>?=`) — ntfy giải mã lại.
 * Nhét thẳng "Nhắc cân" vào header sẽ ra tiêu đề rác hoặc bị fetch từ chối.
 */
function encodeHeaderValue(value: string): string {
  if (ASCII_ONLY.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/**
 * Gửi một thông báo tới ntfy.
 *
 * KHÔNG BAO GIỜ ném lỗi ra ngoài: hàm này chạy trong cron, một lần mất mạng
 * mà làm sập tiến trình thì mọi nhắc nhở sau đó cũng mất theo. Mọi hỏng hóc
 * được ghi log và trả về dưới dạng `{ sent: false, reason }` để chỗ gọi tự xử.
 */
export async function sendNtfyNotification(message: NtfyMessage): Promise<NtfySendResult> {
  const topic = message.topic.trim();
  if (topic === '') return { sent: false, reason: 'no-topic' };

  const url = `${env.NTFY_BASE_URL.replace(/\/+$/, '')}/${encodeURIComponent(topic)}`;
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Title': encodeHeaderValue(message.title),
  };
  if (message.tags?.length) headers['X-Tags'] = encodeHeaderValue(message.tags.join(','));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: message.message,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[ntfy] ${topic}: HTTP ${response.status}`);
      return { sent: false, reason: 'http-error', status: response.status };
    }

    return { sent: true };
  } catch (error) {
    // Gồm cả timeout (AbortError) lẫn lỗi DNS/mạng.
    console.error(`[ntfy] ${topic}: không gửi được —`, error);
    return { sent: false, reason: 'network-error' };
  }
}
