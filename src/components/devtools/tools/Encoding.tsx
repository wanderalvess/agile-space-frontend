'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { OptionGroup, Segmented, ToggleChip, ToolPane, ToolWorkspace } from '@/components/devtools/tool-kit';
import { useToolTab } from '@/components/devtools/useToolTab';
import {
  SAMPLE_BASE64_DECODED,
  SAMPLE_URL,
  deepDecode,
  encodeBase64,
  makeDeepSample,
  processUrl,
  runBase64,
  type DeepResult,
  type UrlScope,
} from '@/lib/devtools/encoding';

type Dir = 'encode' | 'decode';

const DIR_OPTIONS = [{ value: 'decode' as Dir, label: 'Decodificar' }, { value: 'encode' as Dir, label: 'Codificar' }];

// Codificação: Base64, URL e camadas (Deep Decoder) em três abas.
// Junta as antigas telas Base64, URL Encoder e Deep Decoder.
export default function Encoding() {
  const [tab, setTab] = useToolTab('encoding');

  const [b64Dir, setB64Dir] = useState<Dir>('decode');
  const [b64Safe, setB64Safe] = useState(false);
  const [b64Text, setB64Text] = useState('');

  const [urlDir, setUrlDir] = useState<Dir>('encode');
  const [urlScope, setUrlScope] = useState<UrlScope>('component');
  const [plusAsSpace, setPlusAsSpace] = useState(false);
  const [urlText, setUrlText] = useState('');

  const [deepText, setDeepText] = useState('');

  const b64 = useMemo(() => runBase64(b64Text, b64Dir, b64Safe), [b64Text, b64Dir, b64Safe]);
  const url = useMemo(() => processUrl(urlText, urlDir, urlScope, plusAsSpace), [urlText, urlDir, urlScope, plusAsSpace]);
  const deep = useMemo<{ result: DeepResult | null; error: string | null }>(() => {
    if (!deepText.trim()) return { result: null, error: null };
    try {
      return { result: deepDecode(deepText), error: null };
    } catch {
      return { result: null, error: 'Não foi possível processar o conteúdo.' };
    }
  }, [deepText]);

  return (
    <DevToolPage toolId="encoding">
      <ToolWorkspace
        tabs={[{ id: 'base64', label: 'Base64' }, { id: 'url', label: 'URL' }, { id: 'camadas', label: 'Camadas' }]}
        tab={tab as 'base64' | 'url' | 'camadas'}
        onTab={setTab}
        bar={
          tab === 'base64' ? (
            <>
              <OptionGroup label="Direção"><Segmented label="Direção" options={DIR_OPTIONS} value={b64Dir} onChange={setB64Dir} /></OptionGroup>
              <OptionGroup label="Opção"><ToggleChip on={b64Safe} onChange={setB64Safe} title="Troca + e / por - e _ e tira o preenchimento">Base64 seguro para URL</ToggleChip></OptionGroup>
            </>
          ) : tab === 'url' ? (
            <>
              <OptionGroup label="Direção">
                <Segmented label="Direção" options={[{ value: 'encode' as Dir, label: 'Codificar' }, { value: 'decode' as Dir, label: 'Decodificar' }]} value={urlDir} onChange={setUrlDir} />
              </OptionGroup>
              <OptionGroup label="Escopo">
                <Segmented
                  label="Escopo"
                  options={[
                    { value: 'component' as UrlScope, label: 'Valor', title: 'encodeURIComponent: para valores de parâmetros' },
                    { value: 'url' as UrlScope, label: 'URL completa', title: 'encodeURI: preserva : / ? & = #' },
                  ]}
                  value={urlScope}
                  onChange={setUrlScope}
                />
              </OptionGroup>
              {urlDir === 'decode' && (
                <OptionGroup label="Opção"><ToggleChip on={plusAsSpace} onChange={setPlusAsSpace} title="Formulários HTML usam + como espaço">Tratar “+” como espaço</ToggleChip></OptionGroup>
              )}
            </>
          ) : (
            <p className="pb-1 text-[13px] text-muted-foreground">Tenta URL, JSON e Base64 em sequência até nada mais mudar (até 12 camadas).</p>
          )
        }
      >
        {tab === 'base64' && (
          <>
            <ToolPane
              title="Entrada"
              sub={b64Dir === 'decode' ? 'Base64' : 'texto puro'}
              value={b64Text}
              onChange={setB64Text}
              onExample={() => { setB64Dir('decode'); setB64Text(encodeBase64(SAMPLE_BASE64_DECODED)); }}
              markError={b64.error}
              placeholder={b64Dir === 'decode' ? 'Cole o Base64 aqui' : 'Digite ou cole o texto a codificar'}
              footer={`${b64Text.length} caracteres`}
            />
            <ToolPane
              title="Saída"
              sub={b64Dir === 'decode' ? (b64.output ? b64.kind : 'texto puro') : 'Base64'}
              value={b64.output}
              readOnly
              placeholder="O resultado aparece aqui."
              downloadName={b64Dir === 'decode' ? (b64.kind === 'json' ? 'resultado.json' : 'resultado.txt') : 'resultado.b64'}
              error={b64.error}
              footer={b64.output ? `${b64Dir === 'encode' ? 'Codificado' : 'Decodificado'}${b64.kind === 'json' ? ' · o resultado é JSON e foi formatado' : ''} · ${b64.output.length} caracteres` : undefined}
            />
          </>
        )}

        {tab === 'url' && (
          <>
            <ToolPane
              title="Entrada"
              sub={urlDir === 'encode' ? 'texto ou URL' : 'URL codificada'}
              value={urlText}
              onChange={setUrlText}
              onExample={() => { setUrlDir('encode'); setUrlScope('url'); setUrlText(SAMPLE_URL); }}
              placeholder="Cole aqui"
              footer={`${urlText.length} caracteres`}
            />
            <ToolPane
              title="Saída"
              value={url.output}
              readOnly
              placeholder="O resultado aparece aqui."
              downloadName="resultado.txt"
              error={url.error}
              footer={url.output ? `${url.output.length} caracteres` : undefined}
            />
          </>
        )}

        {tab === 'camadas' && (
          <>
            <ToolPane
              title="Entrada"
              sub="conteúdo misterioso"
              value={deepText}
              onChange={setDeepText}
              onExample={() => setDeepText(makeDeepSample())}
              placeholder="Cole Base64, texto URL-encoded ou um JSON com campos em Base64"
              footer={`${deepText.length} caracteres`}
            />
            <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Camadas encontradas">
                <h2 className="mb-2 text-[15px] font-bold text-foreground">Camadas encontradas</h2>
                {deep.result ? (
                  deep.result.layers.length ? (
                    <ol className="flex flex-wrap items-center gap-1.5">
                      {deep.result.layers.map((l, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />}
                          <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 font-code text-xs text-foreground" title={l.note}>
                            {l.kind}{l.note ? ` · ${l.note}` : ''}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma camada de codificação detectada: o conteúdo já está legível.</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">As camadas aplicadas aparecem aqui, em ordem.</p>
                )}
              </section>
              <ToolPane
                title="Conteúdo decodificado"
                value={deep.result?.output ?? ''}
                readOnly
                placeholder="O resultado aparece aqui."
                downloadName="decodificado.txt"
                error={deep.error}
                footer={deep.result ? `${deep.result.layers.length} ${deep.result.layers.length === 1 ? 'camada' : 'camadas'} · ${deep.result.output.length} caracteres` : undefined}
              />
            </div>
          </>
        )}
      </ToolWorkspace>
    </DevToolPage>
  );
}
