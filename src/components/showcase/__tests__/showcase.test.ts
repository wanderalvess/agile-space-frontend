import { describe, it, expect } from 'vitest';
import { isLightBackground } from '../utils';
import { PRESENTATION_PRESETS } from '../types';

describe('Showcase Color & Presentation Presets', () => {
  describe('isLightBackground', () => {
    it('identifies pure white and common white representations', () => {
      expect(isLightBackground('#ffffff')).toBe(true);
      expect(isLightBackground('#fff')).toBe(true);
      expect(isLightBackground('white')).toBe(true);
      expect(isLightBackground('#FFFFFF')).toBe(true);
      expect(isLightBackground('  #ffffff  ')).toBe(true);
    });

    it('identifies light presentation presets', () => {
      const lightPresets = PRESENTATION_PRESETS.filter(p => p.category === 'light');
      expect(lightPresets.length).toBeGreaterThanOrEqual(4);

      lightPresets.forEach(preset => {
        expect(isLightBackground(preset.value)).toBe(true);
      });
    });

    it('identifies dark presentation presets as non-light', () => {
      const darkPresets = PRESENTATION_PRESETS.filter(p => p.category === 'dark');
      expect(darkPresets.length).toBeGreaterThanOrEqual(7);

      darkPresets.forEach(preset => {
        expect(isLightBackground(preset.value)).toBe(false);
      });
    });

    it('identifies high-luminance hex colors', () => {
      expect(isLightBackground('#f0f0f0')).toBe(true);
      expect(isLightBackground('#e5e5e5')).toBe(true);
      expect(isLightBackground('#fefefe')).toBe(true);
    });

    it('identifies low-luminance hex colors as dark', () => {
      expect(isLightBackground('#000000')).toBe(false);
      expect(isLightBackground('#050510')).toBe(false);
      expect(isLightBackground('#0f172a')).toBe(false);
      expect(isLightBackground('#180828')).toBe(false);
    });

    it('handles undefined, empty, or invalid inputs safely', () => {
      expect(isLightBackground(undefined)).toBe(false);
      expect(isLightBackground('')).toBe(false);
      expect(isLightBackground('random-string')).toBe(false);
    });
  });

  describe('PRESENTATION_PRESETS', () => {
    it('has Branco Puro with #ffffff as primary light preset', () => {
      const whitePreset = PRESENTATION_PRESETS.find(p => p.id === 'white');
      expect(whitePreset).toBeDefined();
      expect(whitePreset?.value).toBe('#ffffff');
      expect(whitePreset?.category).toBe('light');
      expect(whitePreset?.isLight).toBe(true);
    });

    it('has all presets configured with valid names, categories, and descriptions', () => {
      PRESENTATION_PRESETS.forEach(p => {
        expect(p.id).toBeTruthy();
        expect(p.name).toBeTruthy();
        expect(['light', 'dark']).toContain(p.category);
        expect(p.value).toBeTruthy();
        expect(p.description).toBeTruthy();
      });
    });
  });
});
