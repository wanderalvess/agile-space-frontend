/**
 * Classes de prosa do artigo, iguais no papel de escrita e na leitura (Escrever / Ler).
 * As cores do plugin de tipografia vêm dos tokens do tema (nada de slate fixo), então valem nos
 * 7 temas, claro e escuro. No TOTVS claro o azul-claro não lê como texto: o link vira cor de texto.
 * As classes são literais de propósito (o Tailwind só gera o que encontra escrito por inteiro).
 */
export const ARTICLE_PROSE =
  'prose prose-lg max-w-none text-foreground ' +
  '[--tw-prose-body:hsl(var(--foreground))] [--tw-prose-headings:hsl(var(--foreground))] ' +
  '[--tw-prose-lead:hsl(var(--muted-foreground))] [--tw-prose-bold:hsl(var(--foreground))] ' +
  '[--tw-prose-counters:hsl(var(--muted-foreground))] [--tw-prose-bullets:hsl(var(--muted-foreground))] ' +
  '[--tw-prose-hr:hsl(var(--border))] [--tw-prose-quotes:hsl(var(--muted-foreground))] ' +
  '[--tw-prose-quote-borders:hsl(var(--primary))] [--tw-prose-captions:hsl(var(--muted-foreground))] ' +
  '[--tw-prose-code:hsl(var(--foreground))] [--tw-prose-pre-code:hsl(var(--foreground))] ' +
  '[--tw-prose-pre-bg:hsl(var(--muted))] [--tw-prose-th-borders:hsl(var(--border))] [--tw-prose-td-borders:hsl(var(--border))] ' +
  '[--tw-prose-links:hsl(var(--primary))] [.theme-totvs:not(.dark)_&]:[--tw-prose-links:hsl(var(--foreground))] ' +
  'prose-headings:font-bold prose-headings:tracking-tight prose-a:underline prose-a:underline-offset-2 ' +
  'prose-blockquote:not-italic prose-blockquote:font-normal prose-blockquote:border-l-[3px] ' +
  '[&_blockquote_p]:before:content-none [&_blockquote_p]:after:content-none ' +
  'prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal ' +
  'prose-code:before:content-none prose-code:after:content-none ' +
  'prose-pre:rounded-xl prose-pre:border prose-pre:border-border [&_pre_code]:bg-transparent [&_pre_code]:p-0';
