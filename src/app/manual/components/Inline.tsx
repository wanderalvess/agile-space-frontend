import Link from 'next/link';
import { BRAND_TEXT, FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { parseInline } from '../data/inline';

const LINK = cn('rounded-sm font-semibold underline underline-offset-2 hover:no-underline', BRAND_TEXT, FOCUS_RING);

/** Texto do Manual com a marcação simples (negrito, código e link) já convertida em elementos. */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((node, i) => {
        switch (node.type) {
          case 'bold':
            return (
              <strong key={i} className="font-semibold text-foreground">
                {node.text}
              </strong>
            );
          case 'code':
            return (
              <code key={i} className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-code text-[0.88em] text-foreground">
                {node.text}
              </code>
            );
          case 'link':
            return node.href.startsWith('/') ? (
              <Link key={i} href={node.href} className={LINK}>
                {node.text}
              </Link>
            ) : (
              <a key={i} href={node.href} target="_blank" rel="noopener noreferrer" className={LINK}>
                {node.text}
              </a>
            );
          default:
            return <span key={i}>{node.text}</span>;
        }
      })}
    </>
  );
}
