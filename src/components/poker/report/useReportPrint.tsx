'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import type { SessionReportData } from '@/lib/poker-report';
import { DEFAULT_PRINT_MODE, ReportPrintPortal, type ReportPrintMode } from './ReportPrintDocument';

/** Título da aba durante a impressão: vira o nome sugerido do arquivo em "Salvar como PDF". */
export function reportDocumentTitle(report: SessionReportData, mode: Pick<ReportPrintMode, 'resultsOnly'> = { resultsOnly: false }): string {
  return `${mode.resultsOnly ? 'Resultados da sessão' : 'Relatório do refinamento'} - ${report.header.title} - ${report.header.dateLabel.replace(/\//g, '-')}`;
}

/**
 * Impressão do relatório pelo navegador (A4 paisagem). Com `interceptBrowserPrint`
 * (tela do relatório), o documento e o CSS de impressão ficam montados o tempo todo,
 * escondidos na tela: assim o `@page` já existe quando o navegador abre a impressão
 * e o Ctrl+P também imprime o relatório em vez da tela da sala. Sem a opção, o
 * documento só entra no DOM enquanto a impressão acontece.
 */
export function useReportPrint(report: SessionReportData, options: { interceptBrowserPrint?: boolean; disabled?: boolean } = {}) {
  const { interceptBrowserPrint = false, disabled = false } = options;
  // false no servidor e na hidratação, true depois (o documento vai para o <body>).
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [printing, setPrinting] = useState(false);
  const [mode, setMode] = useState<ReportPrintMode>(DEFAULT_PRINT_MODE);
  const [now, setNow] = useState<Date>(() => new Date());
  const forced = useRef(false);
  const modeRef = useRef(mode);
  const savedTitle = useRef<string | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (disabled) return;
    const before = () => {
      if (!forced.current && !interceptBrowserPrint) return;
      flushSync(() => {
        setNow(new Date());
        setPrinting(true);
      });
      if (savedTitle.current === null) savedTitle.current = document.title;
      document.title = reportDocumentTitle(report, modeRef.current);
    };
    const after = () => {
      forced.current = false;
      setPrinting(false);
      setMode(DEFAULT_PRINT_MODE);
      if (savedTitle.current !== null) {
        document.title = savedTitle.current;
        savedTitle.current = null;
      }
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [interceptBrowserPrint, disabled, report]);

  const print = useCallback((next: ReportPrintMode = DEFAULT_PRINT_MODE) => {
    forced.current = true;
    modeRef.current = next;
    flushSync(() => {
      setMode(next);
      setNow(new Date());
      setPrinting(true);
    });
    window.print();
  }, []);

  const portal: React.ReactNode = !disabled && mounted && (interceptBrowserPrint || printing) ? <ReportPrintPortal report={report} now={now} mode={mode} /> : null;
  return { print, portal };
}
