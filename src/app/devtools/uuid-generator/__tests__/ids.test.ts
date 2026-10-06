import { nanoId, ulid, uuidV4, uuidV7 } from '../ids';

describe('ids', () => {
  it('uuid v4', () => {
    expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('uuid v7 carrega o timestamp e é ordenável', () => {
    const a = uuidV7(1_700_000_000_000);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(parseInt(a.replace(/-/g, '').slice(0, 12), 16)).toBe(1_700_000_000_000);
    expect(uuidV7(1_700_000_000_001) > a).toBe(true);
  });
  it('ulid e nanoid', () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(nanoId()).toHaveLength(21);
  });
});
