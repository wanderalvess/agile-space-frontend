'use client';

import React from 'react';
import { DECISION, ShowcaseSession } from './types';
import { formatTime, getDirectImageUrl } from './utils';

const decisionHex = (d: keyof typeof DECISION) =>
  d === 'approved' ? '#34d399' : d === 'rejected' ? '#f87171' : d === 'needs_adjustment' ? '#fbbf24' : '#94a3b8';

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
                <div>
                  <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px', color: '#f87171', marginBottom: '6px' }}>O Problema</p>
                  <p style={{ fontSize: '11px', lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', margin: 0 }}>"{task.evidence.problem || 'Não informado'}"</p>
                </div>
                <div>
                  <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px', color: '#34d399', marginBottom: '6px' }}>A Solução</p>
                  <p style={{ fontSize: '11px', lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', margin: 0 }}>"{task.evidence.solution || 'Não informado'}"</p>
                </div>
                {task.acceptanceCriteria && (
                  <div>
                    <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px', color: '#a78bfa', marginBottom: '6px' }}>Critérios de Aceite</p>
                    <p style={{ fontSize: '9px', lineHeight: 1.6, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', margin: 0, whiteSpace: 'pre-wrap' }}>{task.acceptanceCriteria}</p>
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

              {/* Coluna direita: Evidência Visual */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '3px', color: '#818cf8', margin: 0 }}>Evidência Visual</p>
                <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {(task.evidence.screenshot || task.evidence.video) ? (
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
