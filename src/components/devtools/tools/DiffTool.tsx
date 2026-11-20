'use client';

import React, { useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, Eraser, FileText, Plus, TriangleAlert } from 'lucide-react';
import { DiffEditor, Editor } from '@monaco-editor/react';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { OptionGroup, Segmented, ToolButton, ToolPane, ToolWorkspace } from '@/components/devtools/tool-kit';
import { useToolTab } from '@/components/devtools/useToolTab';
import { SelectField, TONES } from '@/components/room-kit';
import { useTheme } from '@/context/ThemeContext';
import {
  SAMPLE_ACTUAL,
  SAMPLE_EXPECTED,
  SAMPLE_PAYLOAD,
  compareJson,
  generateAssertions,
  type DiffItem,
  type Framework,
} from '@/lib/devtools/api-contract';
import { cn } from '@/lib/utils';

type Mode = 'diff' | 'assertions';

const TEXT_LANGUAGES = [
  { value: 'plaintext', label: 'Texto puro' },
  { value: 'xml', label: 'XML' },
];

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  fontFamily: 'var(--font-jetbrains-mono), monospace',
  automaticLayout: true,
  padding: { top: 10, bottom: 10 },
  scrollBeyondLastLine: false,
} as const;

const TEXT_SAMPLE_A = 'Versão 4.2.0\nCorrige o cálculo do frete para pedidos acima de R$ 500,00.\nAdiciona a loja 0412 à lista de lojas piloto.\nTempo limite da API: 5 segundos.';
const TEXT_SAMPLE_B = 'Versão 4.2.1\nCorrige o cálculo do frete para pedidos acima de R$ 500,00.\nAdiciona as lojas 0412 e 0587 à lista de lojas piloto.\nTempo limite da API: 8 segundos.\nNovo limite: 300 requisições por minuto.';
const JSON_SAMPLE_A = JSON.stringify({ id: 10482, status: 'PENDENTE', total: 168.9, cliente: { nome: 'Marina Souza', cpf: null }, itens: 2 }, null, 2);
const JSON_SAMPLE_B = JSON.stringify({ id: 10482, status: 'PAGO', total: 170.5, cliente: { nome: 'Marina Souza' }, itens: 2, pagamento: { forma: 'PIX' } }, null, 2);

const KIND_STYLE: Record<DiffItem['kind'], { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; cls: string }> = {
  missing: { icon: CircleAlert, cls: TONES.danger.text },
  changed: { icon: TriangleAlert, cls: TONES.warn.text },
  added: { icon: Plus, cls: 'text-foreground' },
  same: { icon: CircleCheck, cls: TONES.success.text },
};

// Moldura de painel com título; o conteúdo (Monaco) preenche o resto.
function Frame({ title, sub, accent, children, className }: { title: string; sub?: string; accent?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm', className)}>
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', accent ? 'bg-primary' : 'bg-muted-foreground/50')} />
        <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

// Diff: Texto, JSON (Monaco, lado a lado) e Contrato de API (primeiro nível do JSON e asserções).
// Junta as antigas telas Diff e Diff de API.
export default function DiffTool() {
  const [tab, setTab] = useToolTab('diff');
  const { resolvedMode } = useTheme();
  const monacoTheme = resolvedMode === 'dark' ? 'vs-dark' : 'vs';

  const [textLang, setTextLang] = useState('plaintext');
  const [text, setText] = useState({ original: '', modified: '' });
  const [json, setJson] = useState({ original: '', modified: '' });

  const [mode, setMode] = useState<Mode>('diff');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [payload, setPayload] = useState('');
  const [framework, setFramework] = useState<Framework>('postman');

  const diff = useMemo(
    () => (expected.trim() && actual.trim() ? compareJson(expected, actual) : { items: [] as DiffItem[], error: null as string | null }),
    [expected, actual],
  );
  const assertions = useMemo(
    () => (payload.trim() ? generateAssertions(payload, framework) : { text: '', error: null as string | null }),
    [payload, framework],
  );

  const isMonaco = tab === 'texto' || tab === 'json';
  const sides = tab === 'json' ? json : text;
  const setSides = tab === 'json' ? setJson : setText;
  const language = tab === 'json' ? 'json' : textLang;

  return (
    <DevToolPage toolId="diff">
      <ToolWorkspace
        tabs={[{ id: 'texto', label: 'Texto' }, { id: 'json', label: 'JSON' }, { id: 'contrato', label: 'Contrato de API' }]}
        tab={tab as 'texto' | 'json' | 'contrato'}
        onTab={setTab}
        columns={isMonaco ? 1 : tab === 'contrato' && mode === 'diff' ? 3 : 2}
        bar={
          isMonaco ? (
            <>
              {tab === 'texto' && (
                <OptionGroup label="Linguagem">
                  <SelectField value={textLang} onChange={setTextLang} options={TEXT_LANGUAGES} aria-label="Linguagem" className="w-[150px]" />
                </OptionGroup>
              )}
              <OptionGroup label="Conteúdo">
                <ToolButton onClick={() => setSides(tab === 'json' ? { original: JSON_SAMPLE_A, modified: JSON_SAMPLE_B } : { original: TEXT_SAMPLE_A, modified: TEXT_SAMPLE_B })}>
                  <FileText className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Exemplo
                </ToolButton>
                <ToolButton onClick={() => setSides({ original: '', modified: '' })} disabled={!sides.original && !sides.modified}>
                  <Eraser className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Limpar
                </ToolButton>
              </OptionGroup>
              <p className="pb-1 text-[13px] text-muted-foreground">Edite nos dois painéis de cima; o de baixo mostra as diferenças.</p>
            </>
          ) : (
            <>
              <OptionGroup label="Modo">
                <Segmented label="Modo" options={[{ value: 'diff' as Mode, label: 'Comparar JSON' }, { value: 'assertions' as Mode, label: 'Gerar asserções' }]} value={mode} onChange={setMode} />
              </OptionGroup>
              <OptionGroup label="Conteúdo">
                <ToolButton
                  onClick={() => {
                    if (mode === 'diff') { setExpected(SAMPLE_EXPECTED); setActual(SAMPLE_ACTUAL); } else setPayload(SAMPLE_PAYLOAD);
                  }}
                >
                  <FileText className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Exemplo
                </ToolButton>
              </OptionGroup>
              {mode === 'diff' && <p className="pb-1 text-[13px] text-muted-foreground">Compara só o primeiro nível do JSON.</p>}
            </>
          )
        }
      >
        {isMonaco && (
          <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[2fr_3fr] gap-3 md:gap-4">
            <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              <Frame title="Original">
                <Editor height="100%" language={language} theme={monacoTheme} value={sides.original} onChange={(v) => setSides({ ...sides, original: v ?? '' })} options={EDITOR_OPTIONS} />
              </Frame>
              <Frame title="Alterado">
                <Editor height="100%" language={language} theme={monacoTheme} value={sides.modified} onChange={(v) => setSides({ ...sides, modified: v ?? '' })} options={EDITOR_OPTIONS} />
              </Frame>
            </div>
            <Frame title="Diferenças" accent>
              {/* O DiffEditor é somente leitura: as edições acontecem nos painéis acima */}
              <DiffEditor
                height="100%"
                original={sides.original}
                modified={sides.modified}
                language={language}
                theme={monacoTheme}
                options={{ ...EDITOR_OPTIONS, renderSideBySide: true, readOnly: true }}
              />
            </Frame>
          </div>
        )}

        {tab === 'contrato' && mode === 'diff' && (
          <>
            <ToolPane title="Resposta esperada" sub="referência / Swagger" value={expected} onChange={setExpected} placeholder="Cole o JSON de referência" />
            <ToolPane title="Resposta recebida" sub="homologação" value={actual} onChange={setActual} placeholder="Cole o JSON retornado agora" />
            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <header className="shrink-0 border-b border-border px-4 py-2">
                <h2 className="text-[15px] font-bold text-foreground">Resultado da comparação</h2>
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
                {diff.error ? (
                  <p className={cn('text-sm font-semibold', TONES.danger.text)}>{diff.error}</p>
                ) : diff.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Preencha os dois JSONs para ver as diferenças.</p>
                ) : (
                  diff.items.map((item, i) => {
                    const { icon: Icon, cls } = KIND_STYLE[item.kind];
                    return (
                      <div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-2.5">
                        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cls)} strokeWidth={1.5} />
                        <span className="break-words font-code text-xs text-foreground">{item.text}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}

        {tab === 'contrato' && mode === 'assertions' && (
          <>
            <ToolPane title="Payload de resposta" sub="JSON" value={payload} onChange={setPayload} placeholder="Cole o JSON de resposta da API" error={assertions.error} />
            <ToolPane
              title="Asserções geradas"
              value={assertions.text}
              readOnly
              placeholder="O script aparece aqui."
              downloadName={`asercoes-${framework}.js`}
              toolbar={
                <Segmented
                  label="Ferramenta de teste"
                  options={[{ value: 'postman' as Framework, label: 'Postman' }, { value: 'cypress' as Framework, label: 'Cypress' }, { value: 'playwright' as Framework, label: 'Playwright' }]}
                  value={framework}
                  onChange={setFramework}
                />
              }
            />
          </>
        )}
      </ToolWorkspace>
    </DevToolPage>
  );
}
