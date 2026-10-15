'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { SessionReportData } from '@/lib/poker-report';
import { ReportPrintPortal } from './ReportPrintDocument';

/** Título da aba durante a impressão: vira o nome sugerido do arquivo em "Salvar como PDF". */
export function reportDocumentTitle(report: SessionReportData): string {
  return `Relatório do refinamento - ${report.header.title} - ${report.header.dateLabel.replace(/\//g, '-')}`;
}

/**
 * Impressão do relatório. O documento só existe no DOM enquanto a impressão
 * acontece (entra em `beforeprint`, sai em `afterprint`). Com `interceptBrowserPrint`,
 * o Ctrl+P do navegador também imprime o relatório em vez da tela da sala.
 */
export function useReportPrint(report: SessionReportData, options: { interceptBrowserPrint?: boolean } = {}) {
  const { interceptBrowserPrint = false } = options;
  const [printing, setPrinting] = useState(false);
  const forced = useRef(false);
  const savedTitle = useRef<string | null>(null);
  const title = reportDocumentTitle(report);

  useEffect(() => {
    const before = () => {
      if (!forced.current && !interceptBrowserPrint) return;
      flushSync(() => setPrinting(true));
      if (savedTitle.current === null) savedTitle.current = document.title;
      document.title = title;
    };
    const after = () => {
      forced.current = false;
      setPrinting(false);
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
  }, [interceptBrowserPrint, title]);

  const print = useCallback(() => {
    forced.current = true;
    window.print();
  }, []);

  const portal: React.ReactNode = printing ? <ReportPrintPortal report={report} /> : null;
  return { print, portal };
}
