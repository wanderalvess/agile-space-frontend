import { hslTripleToRgb, mixRgb, type Rgb } from '@/components/retro/retro-scene-contrast';

/** Nome do tema do Monaco que segue os tokens do portal. */
export const MONACO_THEME_NAME = 'portal-jolt';

const hex = (c: Rgb): string => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const withAlpha = (c: Rgb, alpha: number): string => hex(c) + Math.round(alpha * 255).toString(16).padStart(2, '0');

export interface MonacoThemeData {
  base: 'vs' | 'vs-dark';
  inherit: true;
  rules: [];
  colors: Record<string, string>;
}

/**
 * Cores do editor a partir dos tokens do tema ativo (`--background`, `--foreground`, `--primary`...), para o Monaco
 * valer nos 7 temas x claro/escuro em vez de ficar preso a `vs`/`vs-dark`.
 * `read('--background')` devolve a tripla HSL do shadcn ("222.2 84% 4.9%").
 */
export function monacoThemeFromTokens(read: (token: string) => string, dark: boolean): MonacoThemeData {
  const t = (name: string): Rgb => hslTripleToRgb(read(name));
  const bg = t('--background');
  const fg = t('--foreground');
  const muted = t('--muted-foreground');
  const primary = t('--primary');
  const card = t('--card');
  const border = t('--border');
  return {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': hex(bg),
      'editor.foreground': hex(fg),
      'editorGutter.background': hex(bg),
      'editorLineNumber.foreground': hex(mixRgb(muted, bg, 0.9)),
      'editorLineNumber.activeForeground': hex(fg),
      'editor.lineHighlightBackground': hex(mixRgb(fg, bg, 0.06)),
      'editor.lineHighlightBorder': hex(mixRgb(fg, bg, 0.06)),
      'editorCursor.foreground': hex(dark ? primary : mixRgb(primary, fg, 0.6)),
      'editor.selectionBackground': withAlpha(primary, 0.35),
      'editor.inactiveSelectionBackground': withAlpha(primary, 0.18),
      'editorWidget.background': hex(card),
      'editorWidget.border': hex(border),
      'editorIndentGuide.background1': hex(mixRgb(fg, bg, 0.12)),
      'scrollbarSlider.background': withAlpha(muted, 0.25),
      'scrollbarSlider.hoverBackground': withAlpha(muted, 0.4),
    },
  };
}

/** Lê os tokens do `<html>` no navegador. */
export function readDocumentToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}
