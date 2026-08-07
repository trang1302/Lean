import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  localTimeOfDay,
  selectDueReminders,
  runDueReminders,
  type ReminderRunnerDeps,
} from '../../../src/features/reminders/services/reminders.scheduler.js';
import type { ReminderView } from '../../../src/features/reminders/dtos/reminders.response.js';
import { sendNtfyNotification } from '../../../src/shared/clients/ntfy.client.js';

/**
 * Không có test nào ở đây chạm mạng và không có test nào chờ đồng hồ:
 * `now` luôn là tham số, ntfy luôn là hàm giả.
 */

function reminder(over: Partial<ReminderView> = {}): ReminderView {
  return {
    kind: 'weigh_in',
    timeOfDay: '07:00',
    enabled: true,
    ntfyTopic: 'lean-test',
    ...over,
  };
}

/** 00:00Z = 07:00 giờ Asia/Ho_Chi_Minh (UTC+7). */
const AT_0700_LOCAL = new Date('2026-08-06T00:00:00.000Z');

function makeDeps(over: Partial<ReminderRunnerDeps> = {}): ReminderRunnerDeps {
  return {
    listReminders: vi.fn(async () => []),
    hasWeightLogged: vi.fn(async () => false),
    hasMealLogged: vi.fn(async () => false),
    send: vi.fn(async () => ({ sent: true }) as const),
    ...over,
  };
}

describe('localTimeOfDay', () => {
  it('quy đổi về giờ Asia/Ho_Chi_Minh, không phải UTC', () => {
    expect(localTimeOfDay(AT_0700_LOCAL)).toBe('07:00');
  });

  it('đệm số 0 ở đầu và dùng đồng hồ 24 giờ', () => {
    // 17:05Z = 00:05 hôm sau giờ VN — bắt cả lỗi 24:xx của Intl hourCycle h24
    expect(localTimeOfDay(new Date('2026-08-06T17:05:00.000Z'))).toBe('00:05');
    expect(localTimeOfDay(new Date('2026-08-06T13:30:00.000Z'))).toBe('20:30');
  });
});

describe('selectDueReminders', () => {
  it('chọn nhắc nhở có timeOfDay trùng phút hiện tại', () => {
    const due = selectDueReminders([reminder({ timeOfDay: '07:00' })], AT_0700_LOCAL);
    expect(due.map((r) => r.kind)).toEqual(['weigh_in']);
  });

  it('bỏ qua nhắc nhở lệch giờ', () => {
    const due = selectDueReminders([reminder({ timeOfDay: '07:01' })], AT_0700_LOCAL);
    expect(due).toEqual([]);
  });

  it('bỏ qua nhắc nhở enabled = false dù đúng giờ', () => {
    const due = selectDueReminders([reminder({ enabled: false })], AT_0700_LOCAL);
    expect(due).toEqual([]);
  });

  it('bỏ qua nhắc nhở chưa đặt topic', () => {
    const due = selectDueReminders(
      [reminder({ ntfyTopic: null }), reminder({ kind: 'meal_log', ntfyTopic: '   ' })],
      AT_0700_LOCAL,
    );
    expect(due).toEqual([]);
  });

  it('chọn được nhiều nhắc nhở trùng giờ', () => {
    const due = selectDueReminders(
      [reminder(), reminder({ kind: 'meal_log' }), reminder({ kind: 'khac', timeOfDay: '09:00' })],
      AT_0700_LOCAL,
    );
    expect(due.map((r) => r.kind)).toEqual(['weigh_in', 'meal_log']);
  });

  it('không sửa mảng đầu vào', () => {
    const input = [reminder(), reminder({ kind: 'meal_log', timeOfDay: '20:00' })];
    const snapshot = JSON.stringify(input);
    selectDueReminders(input, AT_0700_LOCAL);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('runDueReminders', () => {
  it('gửi weigh_in khi hôm nay chưa ghi cân nặng', async () => {
    const deps = makeDeps({
      listReminders: vi.fn(async () => [reminder({ ntfyTopic: 'lean-weigh' })]),
      hasWeightLogged: vi.fn(async () => false),
    });

    const outcomes = await runDueReminders(AT_0700_LOCAL, deps);

    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deps.send).mock.calls[0]![0]).toMatchObject({ topic: 'lean-weigh' });
    expect(outcomes).toEqual([{ kind: 'weigh_in', status: 'sent' }]);
  });

  it('KHÔNG gửi weigh_in khi hôm nay đã ghi cân nặng', async () => {
    const deps = makeDeps({
      listReminders: vi.fn(async () => [reminder()]),
      hasWeightLogged: vi.fn(async () => true),
    });

    const outcomes = await runDueReminders(AT_0700_LOCAL, deps);

    expect(deps.send).not.toHaveBeenCalled();
    expect(outcomes).toEqual([{ kind: 'weigh_in', status: 'already-logged' }]);
  });

  it('gửi meal_log khi hôm nay chưa ghi bữa nào', async () => {
    const deps = makeDeps({
      listReminders: vi.fn(async () => [
        reminder({ kind: 'meal_log', ntfyTopic: 'lean-meal' }),
      ]),
      hasMealLogged: vi.fn(async () => false),
    });

    await runDueReminders(AT_0700_LOCAL, deps);

    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deps.send).mock.calls[0]![0]).toMatchObject({ topic: 'lean-meal' });
  });

  it('KHÔNG gửi meal_log khi hôm nay đã ghi bữa', async () => {
    const deps = makeDeps({
      listReminders: vi.fn(async () => [reminder({ kind: 'meal_log' })]),
      hasMealLogged: vi.fn(async () => true),
    });

    await runDueReminders(AT_0700_LOCAL, deps);

    expect(deps.send).not.toHaveBeenCalled();
  });

  it('nhắc nhở tắt thì không hỏi DB và không gửi', async () => {
    const deps = makeDeps({
      listReminders: vi.fn(async () => [reminder({ enabled: false })]),
    });

    const outcomes = await runDueReminders(AT_0700_LOCAL, deps);

    expect(deps.hasWeightLogged).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
    expect(outcomes).toEqual([]);
  });

  it('ntfy trả thất bại không làm hàm ném lỗi', async () => {
    const deps = makeDeps({
      listReminders: vi.fn(async () => [reminder()]),
      send: vi.fn(async () => ({ sent: false, reason: 'network-error' }) as const),
    });

    const outcomes = await runDueReminders(AT_0700_LOCAL, deps);

    expect(outcomes).toEqual([{ kind: 'weigh_in', status: 'send-failed' }]);
  });

  it('không có nhắc nhở nào đến giờ thì không gửi gì', async () => {
    const deps = makeDeps({
      listReminders: vi.fn(async () => [reminder({ timeOfDay: '23:00' })]),
    });

    const outcomes = await runDueReminders(AT_0700_LOCAL, deps);

    expect(deps.send).not.toHaveBeenCalled();
    expect(outcomes).toEqual([]);
  });
});

describe('sendNtfyNotification', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POST tới ${NTFY_BASE_URL}/${topic} với tiêu đề và nội dung', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    const result = await sendNtfyNotification({
      topic: 'lean-abc',
      title: 'Nhắc cân',
      message: 'Hôm nay bạn chưa ghi cân nặng.',
    });

    expect(result).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/lean-abc$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('Hôm nay bạn chưa ghi cân nặng.');
  });

  it('tiêu đề có dấu tiếng Việt được mã hóa để header vẫn là ASCII', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    await sendNtfyNotification({ topic: 't', title: 'Nhắc cân', message: 'x' });

    const headers = fetchMock.mock.calls[0]![1].headers as Record<string, string>;
    const title = headers['X-Title'] ?? headers['Title'];
    expect(title).toBeDefined();
    // eslint-disable-next-line no-control-regex
    expect(/^[\x00-\x7F]*$/.test(title!)).toBe(true);
    expect(title).toContain('=?UTF-8?B?');
  });

  it('lỗi mạng bị nuốt — trả trạng thái thất bại, KHÔNG ném ra ngoài', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const result = await sendNtfyNotification({ topic: 't', title: 'a', message: 'b' });

    expect(result).toEqual({ sent: false, reason: 'network-error' });
  });

  it('HTTP lỗi cũng không ném ra ngoài', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));

    const result = await sendNtfyNotification({ topic: 't', title: 'a', message: 'b' });

    expect(result).toEqual({ sent: false, reason: 'http-error', status: 500 });
  });

  it('topic rỗng thì không gọi mạng', async () => {
    const empty = await sendNtfyNotification({ topic: '', title: 'a', message: 'b' });
    const blank = await sendNtfyNotification({ topic: '   ', title: 'a', message: 'b' });

    expect(empty).toEqual({ sent: false, reason: 'no-topic' });
    expect(blank).toEqual({ sent: false, reason: 'no-topic' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
