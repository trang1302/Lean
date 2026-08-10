import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/apiClient';
import {
  buildReminderPatch,
  numericInputToPatchValue,
  textInputToPatchValue,
  updateGoal,
  updateReminder,
} from './settings.api';

// Ba ca này khớp đúng danh sách "đáng viết test trước" ở
// docs/features/web-settings/PLAN.md §5, cộng bốn điều BẮT BUỘC #3/#4 của
// brief điều phối viên (B2).

afterEach(() => {
  vi.restoreAllMocks();
});

describe('numericInputToPatchValue — ô số trống → null, không bao giờ NaN/undefined/""', () => {
  it('chuỗi rỗng → null', () => {
    expect(numericInputToPatchValue('')).toBeNull();
  });

  it('chỉ toàn khoảng trắng → null', () => {
    expect(numericInputToPatchValue('   ')).toBeNull();
  });

  it('chuỗi số hợp lệ → number thô, không định dạng lại', () => {
    expect(numericInputToPatchValue('68')).toBe(68);
    expect(numericInputToPatchValue('68.5')).toBe(68.5);
  });

  it('chuỗi không parse được số → null, không phải NaN', () => {
    const result = numericInputToPatchValue('abc');
    expect(result).toBeNull();
    expect(Number.isNaN(result)).toBe(false);
  });
});

describe('textInputToPatchValue — ô chuỗi trống (ngày, topic) → null', () => {
  it('chuỗi rỗng → null', () => {
    expect(textInputToPatchValue('')).toBeNull();
  });

  it('chỉ toàn khoảng trắng → null', () => {
    expect(textInputToPatchValue('   ')).toBeNull();
  });

  it('chuỗi có nội dung → giữ nguyên, KHÔNG tự trim (server trim, khoảng trắng giữa là lỗi có chủ đích, SPEC §8.3)', () => {
    expect(textInputToPatchValue('lean-abc123')).toBe('lean-abc123');
    expect(textInputToPatchValue('my topic')).toBe('my topic');
  });
});

describe('buildReminderPatch — KHÔNG BAO GIỜ chứa khóa `kind` (điều phối viên B2 #3, SPEC §8.2)', () => {
  it('chỉ giữ đúng các khóa thật sự có mặt trong input', () => {
    const patch = buildReminderPatch({ enabled: true });
    expect(patch).toEqual({ enabled: true });
    expect(patch).not.toHaveProperty('kind');
    expect(patch).not.toHaveProperty('timeOfDay');
    expect(patch).not.toHaveProperty('ntfyTopic');
  });

  it('giữ đủ ba khóa khi input cấp đủ, vẫn không có kind', () => {
    const patch = buildReminderPatch({ timeOfDay: '07:30', enabled: true, ntfyTopic: 'lean-x' });
    expect(patch).toEqual({ timeOfDay: '07:30', enabled: true, ntfyTopic: 'lean-x' });
    expect(patch).not.toHaveProperty('kind');
  });

  it('ntfyTopic: null (xóa topic) được giữ nguyên, không bị lọc mất', () => {
    const patch = buildReminderPatch({ ntfyTopic: null });
    expect(patch).toEqual({ ntfyTopic: null });
    expect('ntfyTopic' in patch).toBe(true);
  });
});

describe('updateReminder — body gửi lên KHÔNG chứa khóa `kind`, dù đầu vào đến từ đâu', () => {
  it('gọi PUT /reminders/:kind với body chỉ có 3 khóa hợp lệ, không có kind', async () => {
    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValue({
      kind: 'weigh_in',
      timeOfDay: '07:30',
      enabled: true,
      ntfyTopic: null,
    });

    await updateReminder('weigh_in', { timeOfDay: '07:30', enabled: true });

    expect(putSpy).toHaveBeenCalledTimes(1);
    const [path, body] = putSpy.mock.calls[0]!;
    expect(path).toBe('/reminders/weigh_in');
    expect(body).not.toHaveProperty('kind');
    expect(body).toEqual({ timeOfDay: '07:30', enabled: true });
  });
});

describe('updateGoal — body gửi lên là patch tường minh, không phải object GET nguyên vẹn', () => {
  it('gọi PUT /goal với đúng object patch được đưa vào, không thêm/bớt khóa lạ', async () => {
    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValue({
      targetWeightKg: 68,
      targetDate: null,
      dailyCalorieTarget: null,
      updatedAt: '2026-08-07T10:00:00.000Z',
    });

    await updateGoal({ targetWeightKg: 68, targetDate: null, dailyCalorieTarget: null });

    expect(putSpy).toHaveBeenCalledWith('/goal', {
      targetWeightKg: 68,
      targetDate: null,
      dailyCalorieTarget: null,
    });
  });
});
