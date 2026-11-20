import { describe, expect, it } from 'vitest';
import { COLUMN_ICONS } from '../../components/retro/column-icons';
import { RETRO_SCENE_LOADERS, clearRetroSceneCache, loadRetroScene } from '../../components/retro/retro-scene-loaders';
import {
  RETRO_FORMAT_THEMES,
  isColumnRenamed,
  resolveColumnIdentity,
  retroFormatTheme,
  retroSceneKey,
  suggestedMinutes,
} from '../retro-format-themes';
import { RETRO_FORMATS } from '../retro-formats';
import { RETRO_TEMPLATES } from '../types';

const THEMED = Object.keys(RETRO_TEMPLATES) as (keyof typeof RETRO_TEMPLATES)[];

describe('mapa RETRO_FORMAT_THEMES: os 17 formatos prontos', () => {
  it('há exatamente 17 formatos prontos, e todos têm identidade (só o personalizado fica de fora)', () => {
    expect(THEMED).toHaveLength(17);
    expect(Object.keys(RETRO_FORMAT_THEMES).sort()).toEqual([...THEMED].sort());
    expect(RETRO_FORMATS.filter((f) => f.key !== 'custom').map((f) => f.key).sort()).toEqual([...THEMED].sort());
    expect(retroFormatTheme('custom')).toBeNull();
  });

  it.each(THEMED)('%s: as colunas do mapa são as de RETRO_TEMPLATES (mesmos ids)', (key) => {
    const ids = RETRO_TEMPLATES[key].map((c) => c.id);
    expect(Object.keys(RETRO_FORMAT_THEMES[key].colunas).sort()).toEqual([...ids].sort());
  });

  it.each(THEMED)('%s: cada coluna tem ícone existente, pergunta-guia, estado vazio e placeholder', (key) => {
    for (const col of RETRO_TEMPLATES[key]) {
      const id = RETRO_FORMAT_THEMES[key].colunas[col.id];
      expect(id, `${key}.${col.id}`).toBeDefined();
      expect(COLUMN_ICONS[id.icon], `ícone ${id.icon}`).toBeDefined();
      for (const text of [id.guia, id.vazio.titulo, id.vazio.dica, id.placeholder]) expect(text.trim().length).toBeGreaterThan(2);
    }
  });

  it.each(THEMED)('%s: cenário, emblema, quebra-gelo e tempos por fase estão preenchidos', (key) => {
    const t = RETRO_FORMAT_THEMES[key];
    expect(t.cenario).toBe(key);
    expect(RETRO_SCENE_LOADERS[t.cenario]).toBeTypeOf('function');
    expect(COLUMN_ICONS[t.emblema]).toBeDefined();
    expect(t.quebraGelo.length).toBeGreaterThan(20);
    expect(t.tag.length).toBeGreaterThan(5);
    for (const minutes of Object.values(t.temposPorFase)) expect(minutes).toBeGreaterThan(0);
  });

  it('só os nove formatos com metáfora em movimento têm elementos animados', () => {
    const animated = THEMED.filter((k) => RETRO_FORMAT_THEMES[k].animado).sort();
    expect(animated).toEqual(['hot_air_balloon', 'incident', 'kudos', 'lean_coffee', 'mad_sad_glad', 'sailboat', 'speed_car', 'starfish', 'workflow']);
  });

  it('a voz do portal: sem "engenharia" e sem culpar pessoas no pós-incidente', () => {
    expect(JSON.stringify(RETRO_FORMAT_THEMES).toLowerCase()).not.toContain('engenharia');
    expect(RETRO_FORMAT_THEMES.incident.colunas.factors.guia.toLowerCase()).toContain('não pessoas');
  });
});

describe('cenário neutro e coluna renomeada', () => {
  it('personalizado, quadro antigo, vazio e chave desconhecida ficam sem cenário', () => {
    for (const key of ['custom', undefined, null, '', 'nao_existe', 'constructor', '__proto__', 'toString']) {
      expect(retroSceneKey(key as string | null | undefined), String(key)).toBeNull();
      expect(retroFormatTheme(key as string | null | undefined)).toBeNull();
      expect(suggestedMinutes(key as string | null | undefined, 'write')).toBeNull();
    }
    expect(retroSceneKey('sailboat')).toBe('sailboat');
  });

  it('coluna com o nome do formato não está renomeada; outro nome, sim (ignora espaços nas pontas)', () => {
    const wind = RETRO_TEMPLATES.sailboat.find((c) => c.id === 'wind')!;
    expect(isColumnRenamed('sailboat', wind)).toBe(false);
    expect(isColumnRenamed('sailboat', { id: 'wind', title: `  ${wind.title} ` })).toBe(false);
    expect(isColumnRenamed('sailboat', { id: 'wind', title: 'Brisa' })).toBe(true);
    expect(isColumnRenamed('custom', { id: 'custom_0_1', title: 'Qualquer' })).toBe(false);
    expect(isColumnRenamed(undefined, wind)).toBe(false);
  });

  it('resolveColumnIdentity devolve a identidade com o aviso de renomeada, ou null fora do mapa', () => {
    const wind = RETRO_TEMPLATES.sailboat.find((c) => c.id === 'wind')!;
    expect(resolveColumnIdentity('sailboat', wind)).toMatchObject({ renamed: false, identity: { icon: 'wind' } });
    expect(resolveColumnIdentity('sailboat', { id: 'wind', title: 'Brisa' })).toMatchObject({ renamed: true, identity: { icon: 'wind' } });
    expect(resolveColumnIdentity('sailboat', { id: 'custom_0', title: 'X' })).toBeNull();
    expect(resolveColumnIdentity('custom', wind)).toBeNull();
  });

  it('o tempo sugerido sai do formato', () => {
    expect(suggestedMinutes('sailboat', 'write')).toBe(RETRO_FORMAT_THEMES.sailboat.temposPorFase.write);
    expect(suggestedMinutes('lean_coffee', 'act')).toBe(25);
  });
});

describe('cenários (SVG): peso, cores e estrutura', () => {
  const ALLOWED_CLASSES = new Set(['p1', 'p2', 'p3', 'f1', 'f2', 'f3', 'f4', 'fa', 'fw', 'fl', 'sl', 'sa', 'dr', 'bob', 'tw']);

  it.each(THEMED)('%s: menos de 8 KB, 3 camadas, sem texto, sem cor fixa e só com as classes do tema', async (key) => {
    clearRetroSceneCache();
    const svg = await loadRetroScene(key);
    expect(new TextEncoder().encode(svg).length, `${key} pesa`).toBeLessThan(8 * 1024);
    for (const layer of ['p1', 'p2', 'p3']) expect(svg, `${key} camada ${layer}`).toContain(`class='${layer}'`);
    expect(svg).not.toMatch(/<text|<image|<foreignObject|<script|<style|<filter|<use\b|href=/i);
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    for (const m of svg.matchAll(/class='([^']*)'/g)) {
      for (const c of m[1].split(/\s+/).filter(Boolean)) expect(ALLOWED_CLASSES.has(c), `${key}: classe ${c}`).toBe(true);
    }
    // toda cor inline vem das variáveis do cenário
    for (const m of svg.matchAll(/(?:stroke|fill):\s*([^;']+)/g)) {
      expect(m[1].trim() === 'none' || m[1].startsWith('var(--'), `${key}: ${m[0]}`).toBe(true);
    }
  });

  it('o carregador guarda o cenário e o mesmo texto volta nas próximas chamadas', async () => {
    clearRetroSceneCache();
    const a = await loadRetroScene('classic');
    const b = await loadRetroScene('classic');
    expect(b).toBe(a);
  });
});
