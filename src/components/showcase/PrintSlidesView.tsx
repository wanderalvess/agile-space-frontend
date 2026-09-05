'use client';

import React from 'react';
import { DECISION, ShowcaseSession, ImpactMetric, ChartType } from './types';
import { formatTime, getDirectImageUrl } from './utils';
import { getCategoryColor } from './chartPresets';

const decisionHex = (d: keyof typeof DECISION) =>
  d === 'approved' ? '#34d399' : d === 'rejected' ? '#f87171' : d === 'needs_adjustment' ? '#fbbf24' : '#94a3b8';

const PRINT_CHART_PALETTE = ['#a78bfa', '#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#60a5fa'];

/**
 * Gráfico de barra/pizza/linha desenhado com SVG/div puro (sem recharts):
 * ResponsiveContainer depende de ResizeObserver, que não dispara a tempo em
 * contexto de impressão (display:none até o @media print ativar) e renderiza
 * altura zero. Dimensões fixas aqui, então funciona em qualquer motor de PDF.
 */
function PrintChart({ type, metrics, maxValue, size = 'sm' }: { type?: ChartType; metrics: ImpactMetric[]; maxValue: number; size?: 'sm' | 'lg' }) {
  if ((!type || type === 'bar') && size === 'lg') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '18px', width: '100%' }}>
        {metrics.map((m, i) => {
          const color = getCategoryColor(m.field) || PRINT_CHART_PALETTE[i % PRINT_CHART_PALETTE.length];
          return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{m.field}</span>
              <span style={{ fontSize: '22px', fontWeight: 900, color }}>{m.value.toLocaleString('pt-BR')}</span>
            </div>
            <div style={{ height: '10px', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(4, (m.value / maxValue) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: '5px' }} />
            </div>
          </div>
          );
        })}
      </div>
    );
  }
  if (type === 'pie') {
    const total = metrics.reduce((sum, m) => sum + Math.max(0, m.value), 0) || 1;
    let cumulative = 0;
    const slices = metrics.map((m, i) => {
      const value = Math.max(0, m.value);
      const startAngle = (cumulative / total) * 2 * Math.PI;
      cumulative += value;
      const endAngle = (cumulative / total) * 2 * Math.PI;
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      const cx = 50, cy = 50, r = 42;
      const x1 = cx + r * Math.sin(startAngle), y1 = cy - r * Math.cos(startAngle);
      const x2 = cx + r * Math.sin(endAngle), y2 = cy - r * Math.cos(endAngle);
      const path = value > 0
        ? `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
        : '';
      return { path, color: getCategoryColor(m.field) || PRINT_CHART_PALETTE[i % PRINT_CHART_PALETTE.length], m };
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
        <svg viewBox="0 0 100 100" style={{ width: size === 'lg' ? '200px' : '150px', height: size === 'lg' ? '200px' : '150px', flexShrink: 0 }}>
          {slices.map((s, i) => s.path && <path key={i} d={s.path} fill={s.color} />)}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{s.m.field}</span>
              <span style={{ fontWeight: 900, color: 'rgba(255,255,255,0.9)' }}>{s.m.value.toLocaleString('pt-BR')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'line') {
    const w = 300, h = 120, pad = 12;
    const points = metrics.map((m, i) => ({
      x: metrics.length > 1 ? pad + (i / (metrics.length - 1)) * (w - pad * 2) : w / 2,
      y: h - pad - (Math.max(0, m.value) / maxValue) * (h - pad * 2),
      m,
    }));
    const polylinePoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: `${h}px` }}>
          <polyline points={polylinePoints} fill="none" stroke="#a78bfa" strokeWidth={2.5} />
          {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#a78bfa" />)}
        </svg>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
          {metrics.map((m, i) => (
            <span key={i}>{m.field}: <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{m.value.toLocaleString('pt-BR')}</strong></span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {metrics.map((m, i) => {
        const color = getCategoryColor(m.field) || PRINT_CHART_PALETTE[i % PRINT_CHART_PALETTE.length];
        return (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
            <span>{m.field}</span>
            <span style={{ fontWeight: 900, color }}>{m.value.toLocaleString('pt-BR')}</span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(4, (m.value / maxValue) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: '4px' }} />
          </div>
        </div>
        );
      })}
    </div>
  );
}

interface PrintSlidesViewProps {
  session: ShowcaseSession | null;
}

/**
 * Componente invisível na UI normal, mas que gera o layout de slides para impressão PDF.
 * Usa inline styles com medidas absolutas para garantir que o layout não colapse no motor de impressão.
 */
export function PrintSlidesView({ session }: PrintSlidesViewProps) {
  if (!session) return null;

  const approved = session.tasks.filter(t => t.decision === 'approved').length;
  const adjustments = session.tasks.filter(t => t.decision === 'needs_adjustment').length;
  const rejected = session.tasks.filter(t => t.decision === 'rejected').length;
  const totalTime = session.tasks.reduce((acc, t) => acc + (t.evidence.timeSpent || 0), 0);

  // Estilos base usados em todos os slides
  const slideStyle: React.CSSProperties = {
    width: '297mm',
    height: '210mm',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#020617',
    color: 'white',
    overflow: 'hidden',
    pageBreakAfter: 'always',
    breakAfter: 'page',
    fontFamily: 'sans-serif',
  };

  return (
    <div className="hidden print:block print-container" style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '297mm', zIndex: 999999, backgroundColor: '#020617' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 landscape; margin: 0; }

          html, body {
            visibility: hidden !important;
            height: auto !important;
            overflow: visible !important;
            background: #020617 !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          style, script { display: none !important; }

          [role="dialog"], [data-radix-portal], header, nav, footer {
            display: none !important;
          }

          .print-container {
            visibility: visible !important;
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            z-index: 999999 !important;
            background: #020617 !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          .print-container * {
            visibility: visible !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
        }
      `}} />

      {/* ── SLIDE 1: CAPA ── */}
      <div style={slideStyle}>
        {/* Coluna Direita: Analytics */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '28%', backgroundColor: 'rgba(255,255,255,0.04)', borderLeft: '1px solid rgba(255,255,255,0.08)', padding: '40px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px' }}>
          <span style={{ fontSize: '8px', fontWeight: 900, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '4px' }}>Sprint Analytics</span>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '7px', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Total Issues</span>
            <span style={{ fontSize: '36px', fontWeight: 900, fontStyle: 'italic', color: 'white' }}>{session.tasks.length}</span>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '7px', fontWeight: 900, color: 'rgba(52,211,153,0.5)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Horas Totais</span>
            <span style={{ fontSize: '36px', fontWeight: 900, fontStyle: 'italic', color: '#34d399' }}>{formatTime(totalTime) || '—'}</span>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '7px', fontWeight: 900, color: 'rgba(167,139,250,0.5)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Resultado</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#34d399' }}>✓ {approved} Aprovados</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#fbbf24' }}>⚠ {adjustments} Ajustes</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#f87171' }}>✗ {rejected} Rejeitados</span>
            </div>
          </div>
        </div>

        {/* Coluna Esquerda: Título */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px', paddingRight: '32%' }}>
          <span style={{ fontSize: '12px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '6px', fontStyle: 'italic', marginBottom: '20px' }}>
            {session.squadName || 'Product Team'}
          </span>
          <h1 style={{ fontSize: '64px', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-2px', lineHeight: 1, color: 'white', margin: 0 }}>
            {session.name || 'Sprint Review'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '32px' }}>
            <div style={{ width: '48px', height: '4px', backgroundColor: '#38bdf8', borderRadius: '2px' }} />
            <span style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '4px' }}>
              {session.period || 'Ciclo de Entrega Atual'}
            </span>
          </div>
        </div>
      </div>

      {/* ── SLIDES DAS TASKS ── */}
      {session.tasks.map((task) => {
        const decisionColor = decisionHex(task.decision);
        const decisionLabel = DECISION[task.decision].label;

        const metrics = task.metrics?.filter(m => m.field.trim()) || [];
        const maxMetricValue = Math.max(...metrics.map(m => m.value), 1);
        const isMetricsCard = task.cardKind === 'metrics';

        return (
          <div key={task.id} style={slideStyle}>
            {/* Header do slide */}
            <div style={{ padding: '32px 40px 20px 40px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'flex-start', justifyItems: 'space-between', flexShrink: 0 }}>
              <div style={{ flex: 1, marginRight: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ backgroundColor: '#7c3aed', color: 'white', padding: '3px 10px', borderRadius: '999px', fontWeight: 900, fontSize: '9px', textTransform: 'uppercase' }}>{task.key}</span>
                  <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>{task.type}</span>
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px', fontStyle: 'italic', color: 'white', margin: 0, lineHeight: 1.2 }}>{task.title}</h2>
              </div>
              <div style={{ border: `1px solid ${decisionColor}`, color: decisionColor, padding: '6px 16px', borderRadius: '12px', fontWeight: 900, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                ✓ {decisionLabel}
              </div>
            </div>

            {/* Corpo do slide: 2 colunas */}
            <div style={{ flex: 1, display: 'flex', padding: '20px 40px 24px 40px', gap: '32px', overflow: 'hidden' }}>
              {/* Coluna esquerda: Info */}
              <div style={{ width: '38%', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
                {isMetricsCard ? (
                  <div>
                    <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px', color: '#a78bfa', marginBottom: '6px' }}>Contexto</p>
                    <p style={{ fontSize: '11px', lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', margin: 0 }}>"{task.description || 'Não informado'}"</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px', color: '#f87171', marginBottom: '6px' }}>O Problema</p>
                      <p style={{ fontSize: '11px', lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', margin: 0 }}>"{task.evidence.problem || 'Não informado'}"</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px', color: '#34d399', marginBottom: '6px' }}>A Solução</p>
                      <p style={{ fontSize: '11px', lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', margin: 0 }}>"{task.evidence.solution || 'Não informado'}"</p>
                    </div>
                  </>
                )}
                {task.acceptanceCriteria && (
                  <div>
                    <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px', color: '#a78bfa', marginBottom: '6px' }}>Critérios de Aceite</p>
                    <p style={{ fontSize: '9px', lineHeight: 1.6, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', margin: 0, whiteSpace: 'pre-wrap' }}>{task.acceptanceCriteria}</p>
                  </div>
                )}
                {metrics.length > 0 && !isMetricsCard && (
                  // Card de métricas já mostra o gráfico grande na coluna direita.
                  <div>
                    <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px', color: '#a78bfa', marginBottom: '6px' }}>{task.chartTitle || 'Métricas de Impacto'}</p>
                    <PrintChart type={task.chartType} metrics={metrics} maxValue={maxMetricValue} />
                  </div>
                )}
                {(task.project || task.versionMaster || task.versionDevelop || task.versionRelease) && (
                  <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                    <p style={{ fontSize: '7px', fontWeight: 900, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>CI/CD & Versões</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9px', color: 'rgba(255,255,255,0.6)' }}>
                      {task.project && <div><strong>Projeto:</strong> {task.project}</div>}
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {task.versionMaster && <div><strong>Master:</strong> {task.versionMaster}</div>}
                        {task.versionDevelop && <div><strong>Develop:</strong> {task.versionDevelop}</div>}
                        {task.versionRelease && <div><strong>Release:</strong> {task.versionRelease}</div>}
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ marginTop: (task.project || task.versionMaster || task.versionDevelop || task.versionRelease) ? '8px' : 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '7px', fontWeight: 900, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Desenvolvedor</p>
                    <p style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', margin: 0 }}>{task.evidence.dev || '—'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '7px', fontWeight: 900, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Validador / QA</p>
                    <p style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', margin: 0 }}>{task.evidence.qa || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Coluna direita: Evidência Visual, ou gráfico grande pro card de métricas */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px', color: '#818cf8', margin: 0 }}>
                  {isMetricsCard ? (task.chartTitle || 'Métricas de Impacto') : 'Evidência Visual'}
                </p>
                <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: isMetricsCard ? 'stretch' : 'center', justifyContent: 'center', overflow: 'hidden', padding: isMetricsCard ? '24px' : 0 }}>
                  {isMetricsCard ? (
                    metrics.length > 0 ? (
                      <PrintChart type={task.chartType} metrics={metrics} maxValue={maxMetricValue} size="lg" />
                    ) : (
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.1)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px' }}>Sem métricas preenchidas</span>
                    )
                  ) : (task.evidence.screenshot || task.evidence.video) ? (
                    <img
                      src={getDirectImageUrl(task.evidence.screenshot || task.evidence.video)}
                      referrerPolicy="no-referrer"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      alt="Evidência"
                    />
                  ) : (
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.1)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px' }}>Sem evidência</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
