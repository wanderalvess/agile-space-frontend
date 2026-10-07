'use client';

import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';

const SAMPLE =
  "select u.id, u.nome, count(p.id) as total from usuarios u left join pedidos p on p.user_id = u.id where u.ativo = 1 and (u.pais = 'BR' or u.pais = 'PT') group by u.id, u.nome having count(p.id) > 2 order by total desc limit 10";

// ---- Tokenização --------------------------------------------------------
// Separa strings/comentários (que nunca devem ser alterados) de palavras e símbolos.
type Tok = { t: 'str' | 'comment' | 'word' | 'sym'; v: string };

function tokenize(sql: string): Tok[] {
  const toks: Tok[] = [];
  const re = /('(?:[^']|'')*'|"(?:[^"]|"")*"|`[^`]*`)|(--[^\n]*|\/\*[\s\S]*?\*\/)|([A-Za-z_][\w$.]*|\d+(?:\.\d+)?|[@:#$]\w+)|(\s+)|(<=>|<>|<=|>=|!=|\|\||::|[\s\S])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    if (m[1]) toks.push({ t: 'str', v: m[1] });
    else if (m[2]) toks.push({ t: 'comment', v: m[2] });
    else if (m[3]) toks.push({ t: 'word', v: m[3] });
    else if (m[5]) toks.push({ t: 'sym', v: m[5] });
  }
  return toks;
}

// Cláusulas que começam em linha nova (nível base).
const CLAUSES = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN',
  'CROSS JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'WITH', 'RETURNING',
]);
// Palavras reservadas que viram maiúsculas (além das cláusulas).
const KEYWORDS = new Set([
  'AS', 'ON', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'ILIKE', 'BETWEEN', 'EXISTS', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'ASC', 'DESC', 'ALL', 'ANY', 'BY', 'INTO', 'TOP', 'USING', 'TRUE', 'FALSE', 'OVER', 'PARTITION', 'CREATE', 'TABLE', 'ALTER', 'DROP',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'CAST',
]);

const up = (s: string) => s.toUpperCase();

function formatSql(sql: string, upper: boolean): string {
  const toks = tokenize(sql);
  const IND = '  ';
  let out = '';
  let level = 0; // indentação por subconsulta
  const parenIsSub: boolean[] = []; // pilha: "(" abriu subconsulta?
  let parenDepth = 0; // parênteses não-subconsulta (vírgulas ficam na mesma linha)
  let atLineStart = true;

  const nl = (lvl: number) => {
    // evita linhas em branco quando já estamos numa linha nova
    if (atLineStart) out = out.replace(/\n[ ]*$/, '');
    out = out.replace(/[ ]+$/, '') + '\n' + IND.repeat(Math.max(lvl, 0));
    atLineStart = true;
  };
  const put = (s: string, space = true) => {
    if (!atLineStart && space && out && !/[(\s.]$/.test(out)) out += ' ';
    out += s;
    atLineStart = false;
  };

  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    if (tk.t === 'str') { put(tk.v); continue; }
    if (tk.t === 'comment') { put(tk.v); if (tk.v.startsWith('--')) nl(level); continue; }

    if (tk.t === 'word') {
      // junta palavras compostas (GROUP BY, LEFT JOIN, ...) olhando 1 e 2 tokens à frente
      const w1 = up(tk.v);
      const n1 = toks[i + 1]?.t === 'word' ? up(toks[i + 1].v) : '';
      const n2 = toks[i + 2]?.t === 'word' ? up(toks[i + 2].v) : '';
      let clause = '';
      let consumed = 0;
      if (CLAUSES.has(`${w1} ${n1} ${n2}`)) { clause = `${w1} ${n1} ${n2}`; consumed = 2; }
      else if (CLAUSES.has(`${w1} ${n1}`)) { clause = `${w1} ${n1}`; consumed = 1; }
      else if (CLAUSES.has(w1)) { clause = w1; }

      if (clause && parenDepth === 0) {
        if (out.trim()) nl(level);
        put(upper ? clause : toks.slice(i, i + consumed + 1).map(x => x.v).join(' '));
        i += consumed;
        // itens da lista ficam na linha seguinte indentados (SELECT, SET, GROUP BY, ORDER BY)
        const nextWord = toks[i + 1]?.t === 'word' ? up(toks[i + 1].v) : '';
        if (['SELECT', 'SET', 'GROUP BY', 'ORDER BY'].includes(clause) && nextWord !== 'DISTINCT' && nextWord !== 'TOP') nl(level + 1);
        continue;
      }
      if (clause && parenDepth > 0) {
        // dentro de parênteses comuns (ex.: IN (...), funções) mantemos em linha
        put(upper ? clause : toks.slice(i, i + consumed + 1).map(x => x.v).join(' '));
        i += consumed;
        continue;
      }
      if ((w1 === 'AND' || w1 === 'OR') && parenDepth === 0) {
        nl(level + 1);
        put(upper ? w1 : tk.v);
        continue;
      }
      if (w1 === 'ON' && parenDepth === 0) {
        nl(level + 1);
        put(upper ? w1 : tk.v);
        continue;
      }
      put(upper && KEYWORDS.has(w1) ? w1 : tk.v);
      continue;
    }

    // símbolos
    const s = tk.v;
    if (s === '(') {
      const next = toks[i + 1];
      const isSub = next?.t === 'word' && ['SELECT', 'WITH'].includes(up(next.v));
      // "(" colado em função/nome; com espaço depois de palavra-chave (IN, AS, ON...)
      const prev = toks[i - 1];
      const glue = prev?.t === 'word' && !KEYWORDS.has(up(prev.v)) || prev?.t === 'word' && ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'CAST'].includes(up(prev.v));
      put('(', !glue);
      parenIsSub.push(isSub);
      if (isSub) { level++; nl(level); } else parenDepth++;
      continue;
    }
    if (s === ')') {
      const isSub = parenIsSub.pop();
      if (isSub) { level = Math.max(level - 1, 0); nl(level); } else parenDepth = Math.max(parenDepth - 1, 0);
      out = out.replace(/[ ]+$/, '');
      out += ')';
      atLineStart = false;
      continue;
    }
    if (s === ',') {
      out = out.replace(/[ ]+$/, '') + ',';
      if (parenDepth === 0) nl(level + 1);
      else out += ' ', (atLineStart = true);
      continue;
    }
    if (s === ';') {
      out = out.replace(/[ ]+$/, '') + ';';
      level = 0;
      nl(0);
      out += '\n';
      continue;
    }
    if (s === '.') { out += '.'; atLineStart = true; continue; }
    // operadores e demais símbolos separados por espaço
    put(s);
  }
  return out.replace(/[ \t]+\n/g, '\n').trim();
}

export default function SqlFormatterPage() {
  const [input, setInput] = useState('');
  const [upper, setUpper] = useState(true);
  const output = useMemo(() => (input.trim() ? formatSql(input, upper) : ''), [input, upper]);

  return (
    <DevToolPage
      toolId="sql-formatter"
      actions={
        <Button variant="outline" size="sm" onClick={() => setInput(SAMPLE)} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <ToolPane title="SQL de entrada" value={input} onChange={setInput} placeholder="Cole a consulta SQL aqui…" footer={`${input.length} caracteres`} />
        <ToolPane
          title="SQL formatado"
          value={output}
          readOnly
          placeholder="O resultado aparece aqui."
          downloadName="query.sql"
          footer={output ? `${output.split('\n').length} linhas` : undefined}
          toolbar={
            <Tabs value={upper ? 'upper' : 'keep'} onValueChange={v => setUpper(v === 'upper')}>
              <TabsList className="h-7 rounded-lg p-0.5">
                <TabsTrigger value="upper" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">MAIÚSCULAS</TabsTrigger>
                <TabsTrigger value="keep" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">Manter</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        />
      </div>
    </DevToolPage>
  );
}
