// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { computeGrowth } from '../admin-platform-utils';
import { PDF_BRAND_RGB, buildGrowthPdf, growthPdfFilename, growthPdfKpis } from '../growth-pdf';

const stats = {
  totalUsers: 164,
  totalShowcaseSessions: 21,
  totalFeedbacks: 48,
  totalPokerRooms: 168,
  totalRetroBoards: 96,
  totalSprintPlannings: 74,
  totalHealthCheckBoards: 36,
  totalBrainstormingBoards: 38,
  totalSessions: 433,
  totalParticipations: 1980,
  avgSessionDurationMinutes: 48,
  sessionDurationSampleSize: 31,
};
const NOW = new Date('2026-10-16T12:00:00Z');

describe('PDF de crescimento', () => {
  it('nome do arquivo preservado', () => {
    expect(growthPdfFilename(NOW)).toBe('relatorio-uso-espaco-agil-2026-10-16.pdf');
  });

  it('os seis cartões usam rótulos honestos e números em pt-BR', () => {
    const kpis = growthPdfKpis(computeGrowth(stats));
    expect(kpis.map((k) => k.title)).toEqual([
      'TOTAL DE SESSÕES',
      'TOTAL DE PARTICIPAÇÕES',
      'TEMPO DE USO MÉDIO',
      'USUÁRIOS TOTAIS',
      'TOTAL DE INTERAÇÕES',
      'TAXA DE FEEDBACK',
    ]);
    const byTitle = Object.fromEntries(kpis.map((k) => [k.title, k]));
    expect(byTitle['TOTAL DE PARTICIPAÇÕES'].value).toBe('1.980');
    expect(byTitle['TEMPO DE USO MÉDIO'].value).toBe('48 min');
    expect(byTitle['TAXA DE FEEDBACK'].value).toBe('29,3%');
    expect(byTitle['TAXA DE FEEDBACK'].subtitle).toBe('48 feedbacks ÷ 164 usuários cadastrados');
    expect(byTitle['TOTAL DE INTERAÇÕES'].value).toBe('433');
  });

  it('sem tempo de uso vira "Em breve"', () => {
    const kpis = growthPdfKpis(computeGrowth({ ...stats, avgSessionDurationMinutes: null, sessionDurationSampleSize: 0 }));
    expect(kpis[2]).toMatchObject({ title: 'TEMPO DE USO', value: 'Em breve' });
  });

  it('gera uma página A4 com texto real, ranking com Review e sem o laranja fixo', () => {
    const doc = buildGrowthPdf(computeGrowth(stats), NOW);
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = doc.output();
    expect(raw.startsWith('%PDF-')).toBe(true);
    // acentos saem em Latin-1 no PDF; confere os textos que são ASCII puro
    for (const text of ['PORTAL TECH V&D', 'SCRUM POKER', 'REVIEW', 'RETROSPECTIVA']) expect(raw).toContain(text);
    // laranja do tema (#FF6A00 = 1 0.4157 0 rg) não pode aparecer; o azul-escuro da marca sim (0 0.1333 0.2 rg)
    expect(raw).not.toMatch(/1 0\.41\d+ 0 rg/);
    expect(PDF_BRAND_RGB).toEqual([0, 34, 51]);
    const fills = [...raw.matchAll(/([0-9.]+) ([0-9.]+) ([0-9.]+) rg/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
    expect(fills.some(([r, g, b]) => Math.abs(r) < 0.01 && Math.abs(g - 34 / 255) < 0.01 && Math.abs(b - 51 / 255) < 0.01)).toBe(true);
    expect(fills.some(([r, g, b]) => r > 0.99 && g > 0.4 && g < 0.43 && b < 0.01)).toBe(false);
    if (process.env.W2_PDF_OUT) writeFileSync(process.env.W2_PDF_OUT, Buffer.from(doc.output('arraybuffer')));
  });

  it('tudo zerado gera o PDF sem NaN', () => {
    const zero = computeGrowth({ ...stats, totalUsers: 0, totalShowcaseSessions: 0, totalFeedbacks: 0, totalPokerRooms: 0, totalRetroBoards: 0, totalSprintPlannings: 0, totalHealthCheckBoards: 0, totalBrainstormingBoards: 0, totalSessions: 0, totalParticipations: 0, avgSessionDurationMinutes: null, sessionDurationSampleSize: 0 });
    const raw = buildGrowthPdf(zero, NOW).output();
    expect(raw).not.toContain('NaN');
    if (process.env.W2_PDF_OUT) writeFileSync(process.env.W2_PDF_OUT.replace('.pdf', '-zero.pdf'), Buffer.from(buildGrowthPdf(zero, NOW).output('arraybuffer')));
  });
});
