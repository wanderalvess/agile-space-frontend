import { circleCalc, convertBytes, operate, rectangleCalc, triangleCalc } from '../logic';

describe('calculators', () => {
  it('aritmética sem ruído de ponto flutuante', () => {
    expect(operate(0.1, '+', 0.2)).toBe(0.3);
    expect(Number.isNaN(operate(1, '/', 0))).toBe(true);
  });
  it('geometria', () => {
    expect(rectangleCalc('3', '4')).toEqual({ area: 12, perimeter: 14 });
    expect(triangleCalc('3', '4')?.area).toBe(6);
    expect(circleCalc('1')?.area).toBeCloseTo(Math.PI, 5);
    expect(circleCalc('')).toBeNull();
  });
  it('bytes', () => {
    expect(convertBytes(1, 'GB', 1024).MB).toBe(1024);
    expect(convertBytes(1, 'GB', 1000).MB).toBe(1000);
  });
});
