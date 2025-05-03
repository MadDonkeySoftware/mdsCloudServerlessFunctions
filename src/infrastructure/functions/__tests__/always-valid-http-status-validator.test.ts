import { alwaysValidHttpStatusValidator } from '../always-valid-http-status-validator';

describe('alwaysValidHttpStatusValidator', () => {
  it('should return true', () => {
    expect(alwaysValidHttpStatusValidator()).toBe(true);
  });
});
