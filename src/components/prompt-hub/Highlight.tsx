import { highlightParts } from '@/app/prompt-hub/catalog-logic';

/** Texto com o termo buscado em destaque (sem tratar o termo como expressão regular). */
export function Highlight({ text, query }: { text?: string | null; query?: string | null }) {
  const parts = highlightParts(text, query);
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-[3px] bg-primary/20 px-0.5 font-bold text-foreground">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}
