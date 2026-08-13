import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, dummyHash } from '../../../src/shared/security/password.js';

describe('hashPassword', () => {
  it('hash cùng một mật khẩu hai lần cho hai chuỗi khác nhau (salt ngẫu nhiên)', async () => {
    const [a, b] = await Promise.all([hashPassword('123456'), hashPassword('123456')]);
    expect(a).not.toBe(b);
  });

  it('hash không chứa mật khẩu gốc dưới dạng chuỗi con', async () => {
    const hash = await hashPassword('mat-khau-rat-de-nhan-ra');
    expect(hash).not.toContain('mat-khau-rat-de-nhan-ra');
  });

  it('dùng Argon2id, không phải Argon2i hay Argon2d', async () => {
    // `hashPassword` cố ý không truyền `options` — nó dựa vào mặc định của
    // @node-rs/argon2. Test này khóa mặc định đó lại: một bản nâng cấp đổi mặc
    // định sang Argon2i (yếu hơn với tấn công GPU) sẽ không đi qua được đây.
    expect(await hashPassword('123456')).toMatch(/^\$argon2id\$/);
  });
});

describe('verifyPassword', () => {
  it('mật khẩu ĐÚNG trả true', async () => {
    // Ca quan trọng nhất của file này: nếu đảo nhầm thứ tự tham số thì
    // verifyPassword luôn trả false và mọi ca "sai" vẫn xanh.
    const hash = await hashPassword('123456');
    expect(await verifyPassword(hash, '123456')).toBe(true);
  });

  it('mật khẩu sai trả false', async () => {
    const hash = await hashPassword('123456');
    expect(await verifyPassword(hash, '123457')).toBe(false);
  });

  it('hash rác trả false, không ném lỗi', async () => {
    // Nhánh "email không tồn tại" ở §7.3 chạy verify với một hash cố định.
    // Nếu hash hỏng làm hàm ném lỗi thì login trả 500 thay vì 401.
    expect(await verifyPassword('khong-phai-hash', '123456')).toBe(false);
  });

  it('chuỗi rỗng ở cả hai phía cũng trả false, không ném lỗi', async () => {
    expect(await verifyPassword('', '')).toBe(false);
  });
});

describe('dummyHash', () => {
  it('trả một hash hợp lệ và verify với mật khẩu bất kỳ đều false', async () => {
    const hash = await dummyHash();
    expect(hash.length).toBeGreaterThan(20);
    expect(await verifyPassword(hash, '123456')).toBe(false);
  });

  it('gọi hai lần trả cùng một chuỗi (memoize, không hash lại mỗi request)', async () => {
    expect(await dummyHash()).toBe(await dummyHash());
  });
});
