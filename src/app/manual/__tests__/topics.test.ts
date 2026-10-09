import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MANUAL_TOPICS, MANUAL_CATEGORIES } from '../data/topics';
import { TOPIC_COMPONENTS } from '../content';

const appDir = path.resolve(__dirname, '../..');

describe('manual: consistência dos tópicos', () => {
  it('todo tópico tem componente, categoria válida e id único', () => {
    const ids = MANUAL_TOPICS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = new Set(MANUAL_CATEGORIES.map(c => c.id));
    for (const t of MANUAL_TOPICS) {
      expect(TOPIC_COMPONENTS[t.id], `sem componente: ${t.id}`).toBeTruthy();
      expect(categories.has(t.category), `categoria inválida: ${t.id}`).toBe(true);
    }
    for (const id of Object.keys(TOPIC_COMPONENTS)) {
      expect(ids, `componente sem tópico: ${id}`).toContain(id);
    }
  });

  it('todo botão de ação aponta para uma rota que existe em src/app', () => {
    for (const t of MANUAL_TOPICS) {
      if (!t.actionUrl) continue;
      const segments = t.actionUrl.split('/').filter(Boolean);
      const dir = path.join(appDir, ...segments);
      const hasPage = fs.existsSync(path.join(dir, 'page.tsx'));
      expect(hasPage, `rota inexistente para ${t.id}: ${t.actionUrl}`).toBe(true);
    }
  });

  it('textos do manual não afirmam coisas que o produto não faz', () => {
    const contentDir = path.join(appDir, 'manual', 'content');
    const all = fs.readdirSync(contentDir).filter(f => f.endsWith('.tsx')).map(f => fs.readFileSync(path.join(contentDir, f), 'utf-8')).join('\n');
    expect(all).not.toMatch(/LocalStorage/i);
    expect(all).not.toMatch(/purga autom/i);
    expect(all).not.toMatch(/por 30 dias/i);
  });
});
