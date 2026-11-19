import { describe, expect, it } from 'vitest';
import { formatDuration, formatPace, paceSecondsPerKm, parseDuration, parseKm, parseLocalDate, speedKmh, toIsoDate } from './format';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [65, '1:05'],
    [3000, '50:00'],
    [3723, '1:02:03'],
    [36000, '10:00:00'],
  ])('%i s → %s', (s, expected) => expect(formatDuration(s)).toBe(expected));
});

describe('parseDuration', () => {
  it.each([
    ['45:30', 2730],
    ['1:05:00', 3900],
    ['0:00:59', 59],
    ['50', 3000],
    ['42,5', 2550],
    [' 12:03 ', 723],
  ])('"%s" → %i s', (input, expected) => expect(parseDuration(input)).toBe(expected));

  it.each(['', 'abc', '1:60', '1:61:00', '1:2:3:4', '0:00', '-5', '12:'])('rejette "%s"', (input) => {
    expect(parseDuration(input)).toBeNull();
  });

  it('fait un aller-retour avec formatDuration', () => {
    for (const s of [59, 600, 3599, 3600, 12345]) expect(parseDuration(formatDuration(s))).toBe(s);
  });
});

describe('allure et vitesse', () => {
  it('calcule l\'allure en s/km', () => {
    expect(paceSecondsPerKm(10000, 3000)).toBe(300);
    expect(paceSecondsPerKm(0, 3000)).toBe(0);
  });

  it('formate l\'allure et gère l\'arrondi à 60 secondes', () => {
    expect(formatPace(312)).toBe(`5'12"/km`);
    expect(formatPace(299.6)).toBe(`5'00"/km`);
    expect(formatPace(0)).toBe('–');
    expect(formatPace(Number.POSITIVE_INFINITY)).toBe('–');
  });

  it('calcule la vitesse en km/h', () => {
    expect(speedKmh(10000, 3600)).toBe(10);
    expect(speedKmh(10000, 0)).toBe(0);
  });
});

describe('parseKm', () => {
  it('accepte virgule et point', () => {
    expect(parseKm('10,5')).toBe(10500);
    expect(parseKm('21.097')).toBe(21097);
  });
  it('rejette les valeurs invalides', () => {
    for (const v of ['', '0', '-3', 'dix']) expect(parseKm(v)).toBeNull();
  });
});

describe('dates locales', () => {
  it('aller-retour sans décalage de fuseau', () => {
    expect(toIsoDate(parseLocalDate('2026-03-29'))).toBe('2026-03-29');
    expect(parseLocalDate('2026-01-05').getDay()).toBe(1); // lundi
  });
});
