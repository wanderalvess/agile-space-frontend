'use client';

import { useEffect } from 'react';

/**
 * Último recurso: erro no próprio layout raiz (fora do alcance do error.tsx). Esta tela SUBSTITUI o documento
 * inteiro, então não tem Tailwind, tema nem provedores do portal: estilos inline, cores que seguem o tema do
 * sistema operacional e nenhuma dependência de componente do app.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <head>
        <title>Algo deu errado | Portal Tech V&amp;D</title>
        <style>{`
          :root { --bg: #ffffff; --fg: #0f172a; --muted: #475569; --border: #cbd5e1; --accent: #0b5cad; --accent-fg: #ffffff; }
          @media (prefers-color-scheme: dark) {
            :root { --bg: #0b1220; --fg: #e2e8f0; --muted: #94a3b8; --border: #334155; --accent: #60a5fa; --accent-fg: #0b1220; }
          }
          html, body { margin: 0; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
          main { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; }
          .box { max-width: 520px; text-align: center; }
          h1 { font-size: 28px; line-height: 1.2; margin: 12px 0 0; }
          p { color: var(--muted); font-size: 14px; line-height: 1.6; margin: 16px auto 0; max-width: 420px; }
          .tag { font-size: 12px; font-weight: 700; letter-spacing: .3em; text-transform: uppercase; color: var(--muted); }
          .actions { margin-top: 32px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
          button, a.btn { font: inherit; font-size: 14px; font-weight: 600; border-radius: 8px; padding: 10px 18px; cursor: pointer; text-decoration: none; }
          button { background: var(--accent); color: var(--accent-fg); border: 1px solid var(--accent); }
          a.btn { background: transparent; color: var(--fg); border: 1px solid var(--border); }
          .code { margin-top: 24px; font-size: 11px; color: var(--muted); }
          .code span { font-family: ui-monospace, monospace; }
        `}</style>
      </head>
      <body>
        <main role="alert">
          <div className="box">
            <div className="tag">Algo deu errado</div>
            <h1>O portal não conseguiu abrir</h1>
            <p>
              Aconteceu um problema inesperado ao carregar a página. O que você já salvou continua salvo. Tente de
              novo; se persistir, volte ao início ou fale com o suporte.
            </p>
            <div className="actions">
              <button type="button" onClick={() => retry()}>
                Tentar de novo
              </button>
              {/* <a> comum, não next/link: sem o layout raiz o roteador do app não está montado. */}
              <a className="btn" href="/">
                Ir para o início
              </a>
            </div>
            {digest ? (
              <div className="code">
                Código do erro para o suporte: <span>{digest}</span>
              </div>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  );
}
