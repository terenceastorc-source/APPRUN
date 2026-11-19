import { describe, expect, it } from 'vitest';
import { niceCeil } from './charts';

describe('niceCeil', () => {
  it('arrondit juste au-dessus avec des pas lisibles', () => {
    expect(niceCeil(2200)).toBe(2500);
    expect(niceCeil(4.7)).toBe(5);
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(13)).toBe(15);
    expect(niceCeil(0)).toBe(1);
  });
});
