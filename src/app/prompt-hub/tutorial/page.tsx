'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FolderTree,
  GraduationCap,
  Layers,
  ListChecks,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Footer } from '@/components/layout/Footer';
import { cn, openExternalUrl } from '@/lib/utils';

const SECTIONS = [
  { id: 'o-que-e', label: 'O que é uma skill' },
  { id: 'quando-usar', label: 'Quando criar uma' },
  { id: 'anatomia', label: 'Anatomia de uma skill' },
  { id: 'passo-a-passo', label: 'Passo a passo' },
  { id: 'frontmatter', label: 'Regras do frontmatter' },
  { id: 'description', label: 'Escrevendo a description' },
  { id: 'liberdade', label: 'Grau de liberdade' },
  { id: 'arquivos', label: 'Quando dividir em arquivos' },
  { id: 'workflows', label: 'Workflows e validação' },
  { id: 'antipadroes', label: 'Anti-padrões' },
  { id: 'checklist', label: 'Checklist final' },
  { id: 'onde-instalar', label: 'Onde instalar' },
  { id: 'padroes-empresa', label: 'Padrões da empresa' }
];

function CodeBlock({ code, caption }: { code: string; caption?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* área de transferência indisponível — o texto continua selecionável */
    }
  };

  return (
    <figure className="space-y-1.5">
      <div className="group relative">
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 font-code text-[13px] leading-relaxed text-foreground">
          {code}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 rounded-md border border-border bg-card p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
          title="Copiar"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {caption && <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

function Section({
  id,
  title,
  icon: Icon,
  children
}: {
  id: string;
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 border-t border-border pt-8 first:border-0 first:pt-0">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
        {Icon && <Icon className="h-5 w-5 text-primary" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Comparison({
  good,
  bad,
  goodLabel = 'Funciona',
  badLabel = 'Evite'
}: {
  good: React.ReactNode;
  bad: React.ReactNode;
  goodLabel?: string;
  badLabel?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <ThumbsUp className="h-4 w-4" />
          {goodLabel}
        </p>
        <div className="text-sm leading-relaxed text-foreground">{good}</div>
      </div>
      <div className="space-y-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-400">
          <ThumbsDown className="h-4 w-4" />
          {badLabel}
        </p>
        <div className="text-sm leading-relaxed text-foreground">{bad}</div>
      </div>
    </div>
  );
}

export default function SkillTutorialPage() {
  const router = useRouter();

  React.useEffect(() => {
    document.title = 'Como criar uma Skill | Espaço Ágil';
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <RoomHeader
        title="Como criar uma Skill"
        toolIcon={<GraduationCap className="h-4 w-4" />}
        toolColorClass="text-primary"
        actions={
          <Button variant="ghost" size="sm" onClick={() => router.push('/prompt-hub')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar à biblioteca
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 gap-10 px-4 py-8 lg:px-8">
        {/* Índice fixo */}
        <nav className="sticky top-24 hidden h-fit w-56 shrink-0 lg:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nesta página
          </p>
          <ul className="space-y-1">
            {SECTIONS.map(section => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 space-y-8 pb-16">
          <header className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Criando sua primeira Agent Skill
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
              Skill é o formato aberto para ensinar um agente de IA a executar um trabalho do jeito
              da nossa empresa. Este guia cobre do zero até a publicação aqui na biblioteca, com as
              regras que a documentação oficial exige e os erros que mais aparecem na prática.
            </p>
          </header>

          <Section id="o-que-e" title="O que é uma skill" icon={Sparkles}>
            <p className="text-sm leading-relaxed text-foreground">
              Uma skill é <strong>uma pasta com um arquivo <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">SKILL.md</code> dentro</strong>. Esse
              arquivo tem um cabeçalho com metadados e um corpo em Markdown com as instruções. A
              pasta pode carregar também scripts, documentos de referência e modelos de arquivo.
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              O agente carrega o conteúdo em três estágios — o que a documentação chama de
              <strong> divulgação progressiva</strong>:
            </p>
            <ol className="space-y-2 text-sm leading-relaxed text-foreground">
              <li>
                <strong>1. Descoberta.</strong> Ao iniciar, o agente lê apenas o <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">name</code> e a{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">description</code> de cada skill. Custa cerca de 100 tokens por skill.
              </li>
              <li>
                <strong>2. Ativação.</strong> Quando a tarefa combina com a description, ele lê o
                corpo do SKILL.md.
              </li>
              <li>
                <strong>3. Execução.</strong> Só então abre arquivos auxiliares ou roda scripts, e
                apenas os que a tarefa exigir.
              </li>
            </ol>
            <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
              Consequência prática: você pode instalar dezenas de skills sem penalizar o contexto.
              O que pesa é o que está no <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">SKILL.md</code>, então ele precisa ser enxuto.
            </p>
          </Section>

          <Section id="quando-usar" title="Quando criar uma skill (e quando não criar)" icon={Layers}>
            <Comparison
              goodLabel="Vale uma skill"
              badLabel="Não vale"
              good={
                <ul className="space-y-1.5">
                  <li>• Você repete o mesmo contexto em toda conversa</li>
                  <li>• O processo tem etapas fixas que não podem ser puladas</li>
                  <li>• Existe uma regra da empresa que a IA não tem como adivinhar</li>
                  <li>• O time inteiro precisa do mesmo resultado padronizado</li>
                </ul>
              }
              bad={
                <ul className="space-y-1.5">
                  <li>• Pedido único, que não vai se repetir — use um prompt</li>
                  <li>• Conhecimento genérico que o modelo já domina</li>
                  <li>• Algo que muda toda semana e viraria manutenção eterna</li>
                  <li>• Instrução de uma frase — publique como Instrução, não como skill</li>
                </ul>
              }
            />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Regra prática da documentação: parta do princípio de que o modelo já é inteligente.
              Só entre na skill o contexto que ele <em>não</em> tem como saber.
            </p>
          </Section>

          <Section id="anatomia" title="Anatomia de uma skill" icon={FolderTree}>
            <CodeBlock
              code={`minha-skill/
├── SKILL.md          # Obrigatório: metadados + instruções
├── reference/        # Opcional: documentos de consulta
│   └── regras.md
├── scripts/          # Opcional: código executável
│   └── validar.py
└── assets/           # Opcional: modelos, exemplos`}
              caption="Só o SKILL.md é obrigatório. O resto entra quando a skill cresce."
            />

            <p className="text-sm leading-relaxed text-foreground">
              O SKILL.md mais simples possível:
            </p>

            <CodeBlock
              code={`---
name: revisao-de-pull-request
description: Revisa pull requests aplicando os padrões de código do time. Use quando alguém pedir revisão de PR, review de código ou análise de diff.
---

# Revisão de Pull Request

## Instruções

1. Leia o diff completo antes de comentar qualquer coisa.
2. Verifique, nesta ordem: correção, casos de borda, legibilidade.
3. Aponte o problema e a correção sugerida na mesma frase.
4. Não comente formatação — o linter já cuida disso.

## Formato da resposta

Uma linha por achado:

arquivo.ts:42 — descrição do problema. Correção sugerida.`}
            />
          </Section>

          <Section id="passo-a-passo" title="Passo a passo" icon={ListChecks}>
            <ol className="space-y-4">
              {[
                {
                  title: 'Faça a tarefa uma vez sem skill',
                  body: 'Resolva o problema conversando normalmente com a IA. Preste atenção no que você teve que explicar: nomes de sistemas, regras internas, formato esperado. É exatamente isso que vira a skill.'
                },
                {
                  title: 'Identifique o que se repete',
                  body: 'Do que você explicou, o que valeria para as próximas dez vezes? Descarte o que era específico daquele caso.'
                },
                {
                  title: 'Peça para a IA escrever a skill',
                  body: 'Os modelos conhecem o formato nativamente. "Crie uma skill que capture o processo que acabamos de fazer, incluindo a regra de sempre excluir contas de teste" costuma bastar.'
                },
                {
                  title: 'Corte o que é óbvio',
                  body: 'Revise pedindo cortes: "remova a explicação sobre o que é uma API, o modelo já sabe". Cada parágrafo precisa justificar seu custo de contexto.'
                },
                {
                  title: 'Teste com uma sessão limpa',
                  body: 'Abra uma conversa nova com a skill carregada e dê uma tarefa real. Observe se ela é acionada sozinha, se as regras são seguidas e onde o agente hesita.'
                },
                {
                  title: 'Ajuste com base no que viu',
                  body: 'Se a skill não foi acionada, o problema quase sempre está na description. Se foi acionada mas ignorou uma regra, torne a regra mais explícita ou mais visível no arquivo.'
                },
                {
                  title: 'Publique na biblioteca',
                  body: 'Volte ao Hub, escolha o tipo Skill e cole o SKILL.md. Descreva no campo de descrição quando o time deve usá-la.'
                }
              ].map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="frontmatter" title="Regras do frontmatter" icon={Wrench}>
            <p className="text-sm leading-relaxed text-foreground">
              Dois campos são obrigatórios, e a validação é rígida:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Campo</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Regras</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  <tr className="border-b border-border align-top">
                    <td className="py-3 pr-4 font-code text-[13px]">name</td>
                    <td className="py-3 pr-4 leading-relaxed">
                      Até 64 caracteres. Apenas letras minúsculas, números e hífens. Não pode conter
                      tags XML nem as palavras reservadas <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">anthropic</code> e{' '}
                      <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">claude</code>.
                    </td>
                  </tr>
                  <tr className="align-top">
                    <td className="py-3 pr-4 font-code text-[13px]">description</td>
                    <td className="py-3 pr-4 leading-relaxed">
                      Obrigatória, até 1024 caracteres, sem tags XML. Precisa dizer{' '}
                      <strong>o que a skill faz</strong> e <strong>quando usá-la</strong>. Sempre em
                      terceira pessoa.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm leading-relaxed text-foreground">
              Para o <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">name</code>, a convenção sugerida é o gerúndio da ação:
            </p>
            <Comparison
              good={
                <ul className="space-y-1 font-code text-[13px]">
                  <li>revisando-pull-requests</li>
                  <li>analisando-planilhas</li>
                  <li>gerando-relatorio-sprint</li>
                </ul>
              }
              bad={
                <ul className="space-y-1 font-code text-[13px]">
                  <li>helper</li>
                  <li>utils</li>
                  <li>documentos</li>
                </ul>
              }
            />
          </Section>

          <Section id="description" title="Escrevendo a description" icon={Sparkles}>
            <p className="text-sm leading-relaxed text-foreground">
              Este é o campo que mais determina se a skill vai funcionar. Ele é o único texto que o
              agente vê antes de decidir abrir a skill, e ele escolhe entre dezenas de opções. Uma
              description vaga significa uma skill que nunca é acionada.
            </p>

            <Comparison
              good={
                <div className="space-y-3">
                  <p className="font-code text-[13px]">
                    description: Extrai texto e tabelas de arquivos PDF, preenche formulários e junta
                    documentos. Use ao trabalhar com PDFs ou quando o usuário mencionar formulários
                    ou extração de documentos.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Diz o que faz, lista os gatilhos e usa os termos que a pessoa realmente digita.
                  </p>
                </div>
              }
              bad={
                <div className="space-y-3">
                  <p className="font-code text-[13px]">description: Ajuda com documentos</p>
                  <p className="font-code text-[13px]">description: Eu posso processar seus arquivos</p>
                  <p className="text-xs text-muted-foreground">
                    A primeira não tem gatilho nenhum. A segunda está em primeira pessoa — a
                    documentação alerta que isso atrapalha a descoberta, porque o texto é injetado
                    no prompt de sistema.
                  </p>
                </div>
              }
            />
          </Section>

          <Section id="liberdade" title="Grau de liberdade" icon={Layers}>
            <p className="text-sm leading-relaxed text-foreground">
              Calibre o nível de detalhe pela fragilidade da tarefa. A analogia da documentação: o
              agente é um robô percorrendo um caminho.
            </p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                {
                  level: 'Alta liberdade',
                  when: 'Campo aberto, vários caminhos válidos',
                  how: 'Descreva o objetivo e princípios. Ex: passos gerais de uma revisão de código.'
                },
                {
                  level: 'Liberdade média',
                  when: 'Existe um padrão preferido, com variação aceitável',
                  how: 'Ofereça um modelo ou função parametrizada para adaptar.'
                },
                {
                  level: 'Baixa liberdade',
                  when: 'Ponte estreita: erro custa caro',
                  how: 'Comando exato, sem margem. Ex: "rode exatamente este script, sem alterar as flags".'
                }
              ].map(item => (
                <div key={item.level} className="space-y-2 rounded-lg border border-border p-4">
                  <h3 className="text-sm font-semibold text-foreground">{item.level}</h3>
                  <p className="text-xs text-muted-foreground">{item.when}</p>
                  <p className="text-sm leading-relaxed text-foreground">{item.how}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="arquivos" title="Quando dividir em vários arquivos" icon={FolderTree}>
            <p className="text-sm leading-relaxed text-foreground">
              Mantenha o corpo do SKILL.md <strong>abaixo de 500 linhas</strong>. Passou disso, mova
              o detalhe para arquivos de referência e deixe o SKILL.md como um índice.
            </p>

            <CodeBlock
              code={`# Análise de dados

## Bases disponíveis

**Financeiro**: receita, faturamento → ver reference/financeiro.md
**Vendas**: pipeline, oportunidades → ver reference/vendas.md
**Produto**: uso de API, adoção → ver reference/produto.md`}
              caption="O agente lê só o arquivo que a pergunta exige. Os outros custam zero token."
            />

            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm leading-relaxed text-foreground">
                <strong>Referências devem ter um nível só de profundidade.</strong> Se o SKILL.md
                aponta para <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">avancado.md</code>, que aponta para{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">detalhes.md</code>, o agente tende a ler os arquivos aninhados
                pela metade e trabalhar com informação incompleta. Ligue tudo direto do SKILL.md.
              </p>
            </div>

            <p className="text-sm leading-relaxed text-foreground">
              Em arquivos de referência com mais de 100 linhas, coloque um índice no topo — assim o
              agente enxerga o escopo mesmo quando lê só o começo do arquivo.
            </p>
          </Section>

          <Section id="workflows" title="Workflows e laços de validação" icon={ListChecks}>
            <p className="text-sm leading-relaxed text-foreground">
              Para processos de várias etapas, entregue uma lista de verificação que o agente copia
              e vai marcando. Isso reduz muito a chance de ele pular uma etapa crítica.
            </p>

            <CodeBlock
              code={`## Fluxo de fechamento de sprint

Copie esta lista e marque conforme avança:

- [ ] Etapa 1: coletar as issues concluídas
- [ ] Etapa 2: cruzar com o worklog registrado
- [ ] Etapa 3: identificar itens sem worklog
- [ ] Etapa 4: gerar o resumo executivo
- [ ] Etapa 5: validar os números com o board

**Etapa 3: identificar itens sem worklog**

Se houver itens sem registro, pare e liste antes de seguir para a etapa 4.`}
            />

            <p className="text-sm leading-relaxed text-foreground">
              O outro padrão que mais melhora qualidade é o laço{' '}
              <strong>validar → corrigir → repetir</strong>: depois de cada alteração, rode a
              verificação e só avance quando ela passar. O validador não precisa ser um script —
              pode ser um guia de estilo que o agente confere item a item.
            </p>
          </Section>

          <Section id="antipadroes" title="Anti-padrões" icon={TriangleAlert}>
            <ul className="space-y-3 text-sm leading-relaxed text-foreground">
              <li>
                <strong>Informação com prazo de validade.</strong> Nada de "antes de agosto use a
                API antiga". Documente o padrão atual e jogue o histórico para uma seção de
                legado.
              </li>
              <li>
                <strong>Excesso de opções.</strong> "Use a biblioteca A, ou a B, ou a C" gera
                indecisão. Dê um padrão e, se necessário, uma exceção clara.
              </li>
              <li>
                <strong>Vocabulário inconsistente.</strong> Escolha um termo e repita. Alternar
                entre "campo", "caixa" e "elemento" para a mesma coisa atrapalha a leitura.
              </li>
              <li>
                <strong>Caminhos com barra invertida.</strong> Use sempre{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">scripts/validar.py</code>, nunca{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">scripts\validar.py</code> — a barra invertida quebra fora do Windows.
              </li>
              <li>
                <strong>Constantes mágicas em scripts.</strong> Se você não sabe justificar por que
                o timeout é 47, o agente também não vai saber.
              </li>
              <li>
                <strong>Supor que o pacote está instalado.</strong> Liste as dependências
                explicitamente nas instruções.
              </li>
            </ul>
          </Section>

          <Section id="checklist" title="Checklist antes de publicar" icon={ListChecks}>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
              {[
                'A description diz o que faz E quando usar',
                'A description está em terceira pessoa',
                'O name usa só minúsculas, números e hífens',
                'O corpo do SKILL.md tem menos de 500 linhas',
                'Referências estão a um nível de profundidade',
                'Não há informação com prazo de validade',
                'A terminologia é consistente do início ao fim',
                'Os exemplos são concretos, não abstratos',
                'Fluxos com várias etapas têm lista de verificação',
                'Segredos e tokens foram removidos do conteúdo',
                'Testada em uma sessão limpa, com tarefa real',
                'Alguém do time leu e entendeu sem explicação extra'
              ].map(item => (
                <label key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
                  />
                  <span className="leading-relaxed">{item}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section id="onde-instalar" title="Onde a skill vai morar" icon={FolderTree}>
            <div className="space-y-3 text-sm leading-relaxed text-foreground">
              <p>
                O local muda conforme a ferramenta, e <strong>skills não sincronizam entre elas</strong>:
                subir numa não disponibiliza na outra.
              </p>
              <ul className="space-y-2">
                <li>
                  <strong>Claude Code:</strong> pasta no sistema de arquivos —{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">~/.claude/skills/</code> para uso pessoal ou{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-code text-[13px]">.claude/skills/</code> dentro do projeto, para o time inteiro
                  via repositório.
                </li>
                <li>
                  <strong>claude.ai:</strong> upload de um .zip em Configurações &gt; Recursos. É
                  individual: cada pessoa precisa subir a sua.
                </li>
                <li>
                  <strong>API:</strong> upload pelos endpoints de skills. Aí sim o acesso é
                  compartilhado por workspace.
                </li>
              </ul>
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p>
                  <strong>Skill é código que roda com as suas permissões.</strong> Trate instalar uma
                  skill de terceiros como instalar um programa: leia o SKILL.md e todos os scripts
                  antes. Desconfie especialmente de skills que buscam conteúdo de URLs externas.
                </p>
              </div>
            </div>
          </Section>

          <Section id="padroes-empresa" title="Padrões da empresa" icon={Wrench}>
            <div className="rounded-lg border border-dashed border-border p-6 text-sm leading-relaxed text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">Seção reservada</p>
              <p>
                Aqui entram as convenções internas: nomenclatura adotada, onde versionar as skills
                do time, quais dados não podem aparecer no conteúdo, e o processo de revisão antes
                de publicar. Assim que a documentação oficial for enviada, este bloco é preenchido
                sem mexer no restante do guia.
              </p>
            </div>
          </Section>

          <section className="flex flex-wrap items-center gap-3 border-t border-border pt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openExternalUrl('https://agentskills.io/home')}
              className="gap-2"
            >
              Especificação aberta
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                openExternalUrl(
                  'https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices'
                )
              }
              className="gap-2"
            >
              Boas práticas de autoria
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={() => router.push('/prompt-hub')} className="gap-2">
              Publicar minha skill
            </Button>
          </section>
        </main>
      </div>

      <Footer />
    </div>
  );
}
