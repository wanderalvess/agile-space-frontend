import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/devtools/x',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ session: { id: 'u1', name: 'Ana' } }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ resolvedMode: 'light' }) }));
// A casca é testada à parte; aqui só importa o conteúdo de cada aba.
vi.mock('../DevToolPage', () => ({ DevToolPage: ({ children }: { children: React.ReactNode }) => <div data-tool-body>{children}</div> }));
// O Monaco não roda no jsdom: um campo simples mostra o que cada lado recebeu.
vi.mock('@monaco-editor/react', () => ({
  Editor: ({ value, language }: { value: string; language: string }) => <textarea aria-label={`editor-${language}`} readOnly value={value} />,
  DiffEditor: ({ original, modified, language }: { original: string; modified: string; language: string }) => (
    <div aria-label={`diff-${language}`}>{`${original}=>${modified}`}</div>
  ),
}));

import DataStudio from '../tools/DataStudio';
import Encoding from '../tools/Encoding';
import DiffTool from '../tools/DiffTool';
import MassaDeDados from '../tools/MassaDeDados';
import { ToolPane } from '../ToolPane';

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value } });
const val = (label: string | RegExp) => (screen.getByRole('textbox', { name: label }) as HTMLTextAreaElement).value;
const tab = (name: RegExp | string) => screen.getByRole('tab', { name });

beforeEach(() => {
  search = '';
  window.localStorage.clear();
});
afterEach(() => cleanup());

describe('Estúdio de Dados (JSON + XML + YAML + SQL + Schema)', () => {
  it('abre na aba Formatar; ?formato= escolhe o formato (rotas /json, /xml, /sql-formatter)', () => {
    search = 'aba=formatar&formato=xml';
    render(<DataStudio />);
    expect(tab('Formatar').getAttribute('aria-selected')).toBe('true');
    type('Entrada', '<a><b>1</b></a>');
    expect(val('Saída')).toBe('<a>\n  <b>\n    1\n  </b>\n</a>');
  });

  it('Formatar JSON: formata, minifica e mostra o erro com linha e coluna no rodapé', () => {
    render(<DataStudio />);
    type('Entrada', '{"a":[1,2]}');
    expect(val('Saída')).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
    fireEvent.click(screen.getByRole('button', { name: 'Minificar' }));
    expect(val('Saída')).toBe('{"a":[1,2]}');
    type('Entrada', '{\n "a": 1,\n b\n}');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/JSON inválido na linha \d+, coluna \d+/);
    expect(within(alert).getByRole('button', { name: 'Ir para o erro' })).toBeTruthy();
  });

  it('Formatar SQL e YAML chamam o formatador de cada um; Minificar só vale para JSON e XML', () => {
    render(<DataStudio />);
    fireEvent.click(screen.getByRole('button', { name: 'SQL' }));
    expect((screen.getByRole('button', { name: 'Minificar' }) as HTMLButtonElement).disabled).toBe(true);
    type('Entrada', 'select a,b from t where x=1');
    expect(val('Saída')).toContain('SELECT');
    expect(val('Saída')).toContain('FROM');
    fireEvent.click(screen.getByRole('button', { name: 'YAML' }));
    type('Entrada', 'a:    1');
    expect(val('Saída')).toBe('a: 1\n');
  });

  it('Converter: YAML para JSON (rota /yaml-converter) e Inverter', () => {
    search = 'aba=converter&de=yaml&para=json';
    render(<DataStudio />);
    expect(tab('Converter').getAttribute('aria-selected')).toBe('true');
    type('Entrada', 'a: 1\nb: [x]\n');
    expect(JSON.parse(val(/Saída em JSON/))).toEqual({ a: 1, b: ['x'] });
    fireEvent.click(screen.getByRole('button', { name: /Inverter/ }));
    expect(screen.getByRole('textbox', { name: /Saída em YAML/ })).toBeTruthy();
    expect(JSON.parse(val('Entrada'))).toEqual({ a: 1, b: ['x'] });
  });

  it('Schema: gera o schema de um JSON e valida um payload contra um schema', () => {
    search = 'aba=schema';
    render(<DataStudio />);
    type('JSON de exemplo', '{"id":1,"nome":"x"}');
    expect(JSON.parse(val('Schema gerado'))).toMatchObject({ $schema: expect.any(String), type: 'object', required: ['id', 'nome'] });
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }));
    type('Schema', JSON.stringify({ type: 'object', required: ['id'], properties: { id: { type: 'integer' } } }));
    type('Payload', '{"id":"um"}');
    expect(screen.getByText('Falha na validação')).toBeTruthy();
    expect(screen.getByText(/Esperava tipo "integer"/)).toBeTruthy();
    type('Payload', '{"id":1}');
    expect(screen.getByText('O conteúdo condiz com o schema.')).toBeTruthy();
  });
});

describe('Codificação (Base64 + URL + Camadas)', () => {
  it('Base64 decodifica JSON já formatado (rota /base64)', () => {
    search = 'aba=base64';
    render(<Encoding />);
    type('Entrada', 'eyJhIjoxfQ==');
    expect(val('Saída')).toBe('{\n  "a": 1\n}');
    fireEvent.click(screen.getByRole('button', { name: 'Codificar' }));
    type('Entrada', 'oi');
    expect(val('Saída')).toBe('b2k=');
  });

  it('URL codifica valor e decodifica (rota /url-encoder)', () => {
    search = 'aba=url';
    render(<Encoding />);
    expect(tab('URL').getAttribute('aria-selected')).toBe('true');
    type('Entrada', 'a b&c');
    expect(val('Saída')).toBe('a%20b%26c');
    fireEvent.click(screen.getAllByRole('button', { name: 'Decodificar' })[0]);
    type('Entrada', 'a%20b');
    expect(val('Saída')).toBe('a b');
  });

  it('Camadas desfaz URL + JSON + Base64 e lista as camadas (rota /deep-decoder)', () => {
    search = 'aba=camadas';
    render(<Encoding />);
    const inner = btoa('{"nome":"texto interno longo"}');
    type('Entrada', encodeURIComponent(JSON.stringify({ x: inner })));
    expect(within(screen.getByRole('list')).getByText('URL')).toBeTruthy();
    expect(screen.getByText(/JSON · 1 campo/)).toBeTruthy();
    expect(JSON.parse(val('Conteúdo decodificado')).x).toEqual({ nome: 'texto interno longo' });
  });

  it('aba desconhecida cai na primeira', () => {
    search = 'aba=nada';
    render(<Encoding />);
    expect(tab('Base64').getAttribute('aria-selected')).toBe('true');
  });
});

describe('Diff (Texto + JSON + Contrato de API)', () => {
  it('Texto e JSON usam o diff do Monaco com a linguagem certa', () => {
    render(<DiffTool />);
    expect(screen.getByLabelText('diff-plaintext')).toBeTruthy();
    fireEvent.click(tab('JSON'));
    expect(screen.getByLabelText('diff-json')).toBeTruthy();
  });

  it('Contrato de API compara o primeiro nível e gera asserções (rota /api-diff)', () => {
    search = 'aba=contrato';
    render(<DiffTool />);
    type('Resposta esperada', '{"a":1,"b":2}');
    type('Resposta recebida', '{"a":2,"c":3}');
    expect(screen.getByText(/Campo ausente na resposta atual: "b"/)).toBeTruthy();
    expect(screen.getByText(/Campo novo na resposta atual: "c"/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar asserções' }));
    type('Payload de resposta', '{"ok":true}');
    expect(val('Asserções geradas')).toContain("pm.expect(responseData.ok).to.be.a('boolean')");
    fireEvent.click(screen.getByRole('button', { name: 'Playwright' }));
    expect(val('Asserções geradas')).toContain("toHaveProperty('ok')");
  });
});

describe('Massa de Dados (Massa + CPF e CNPJ)', () => {
  it('gera ao abrir, respeita a quantidade e exporta no formato escolhido', () => {
    render(<MassaDeDados />);
    expect(screen.getByRole('region', { name: 'Lote gerado' })).toBeTruthy();
    expect(screen.getByText(/10 CPFs gerados/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Quantidade de registros' }), { target: { value: '5001' } });
    expect(screen.getByText(/O lote aceita de 1 a 1\.000 registros/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Gerar de novo/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Quantidade de registros' }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Gerar de novo/ }));
    expect(screen.getByText(/3 CPFs gerados/)).toBeTruthy();
  });

  it('?tipo=cnpj-alfa (rota /doc-generator) abre no CNPJ alfanumérico com filiais', () => {
    search = 'aba=gerar&tipo=cnpj-alfa';
    render(<MassaDeDados />);
    expect(screen.getByRole('button', { name: 'Alfanumérico', pressed: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Mesma raiz, filiais/ })).toBeTruthy();
  });

  it('salva um conjunto por usuário, reutiliza e exclui com confirmação', () => {
    render(<MassaDeDados />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar conjunto' }));
    expect(screen.getByText('Conjunto 1')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('agile-devtools:massa:u1')!)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'CNPJ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Usar o conjunto Conjunto 1' }));
    expect(screen.getByText(/10 CPFs gerados/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir o conjunto Conjunto 1' }));
    expect(screen.getByText('Excluir o conjunto "Conjunto 1"?')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    expect(screen.getByText('Nenhum conjunto salvo ainda.')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('agile-devtools:massa:u1')!)).toEqual([]);
  });

  it('Validar confere um documento por linha', () => {
    search = 'aba=validar';
    render(<MassaDeDados />);
    type('Documentos', '111.444.777-35\n123.456.789-00');
    expect(screen.getByText('1 válidos, 1 inválidos')).toBeTruthy();
    expect(screen.getByText('Válido')).toBeTruthy();
    expect(screen.getByText('Inválido')).toBeTruthy();
  });
});

describe('ToolPane renovado', () => {
  it('erro com linha e coluna marca a linha, mostra o rodapé e leva o foco à entrada', () => {
    function Harness() {
      const [v, setV] = React.useState('linha 1\nlinha 2\nlinha 3');
      return (
        <div data-tool-body>
          <ToolPane title="Entrada" value={v} onChange={setV} error="JSON inválido na linha 2, coluna 3." />
          <ToolPane title="Saída" value="" readOnly error="JSON inválido na linha 2, coluna 3." />
        </div>
      );
    }
    render(<Harness />);
    const entrada = screen.getByRole('textbox', { name: 'Entrada' }) as HTMLTextAreaElement;
    expect(entrada.getAttribute('aria-invalid')).toBe('true');
    const botoes = screen.getAllByRole('button', { name: 'Ir para o erro' });
    expect(botoes).toHaveLength(2);
    fireEvent.click(botoes[1]); // o da saída leva à entrada
    expect(document.activeElement).toBe(entrada);
    expect(entrada.selectionStart).toBe('linha 1\n'.length + 2);
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });

  it('sem erro mostra o rodapé informativo e os botões nomeados', () => {
    render(<ToolPane title="Saída" value="abc" readOnly downloadName="x.txt" footer="3 caracteres" />);
    expect(screen.getByText('3 caracteres')).toBeTruthy();
    for (const n of ['Baixar', 'Copiar']) expect(screen.getByRole('button', { name: n })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Colar' })).toBeNull();
  });
});

