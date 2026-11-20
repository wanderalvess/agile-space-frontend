'use client';

import * as React from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/components/room-kit';

interface Tool {
  id: string;
  label: string;
  shortcut?: string;
  icon?: LucideIcon;
  text?: string;
  /** undefined = botão de ação (sem aria-pressed). */
  active?: boolean;
  disabled?: boolean;
  run: () => void;
}

function useToolbarState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      code: e.isActive('code'),
      codeBlock: e.isActive('codeBlock'),
      link: e.isActive('link'),
    }),
  });
}

/** Barra de formatação do editor: cada botão tem nome, estado (aria-pressed) e o atalho nativo do TipTap. */
export function FormatToolbar({ editor, onLinkClick, className }: { editor: Editor; onLinkClick: () => void; className?: string }) {
  const s = useToolbarState(editor);
  const chain = () => editor.chain().focus();

  const groups: Tool[][] = [
    [
      { id: 'undo', label: 'Desfazer', shortcut: 'Ctrl+Z', icon: Undo2, disabled: !s.canUndo, run: () => chain().undo().run() },
      { id: 'redo', label: 'Refazer', shortcut: 'Ctrl+Shift+Z', icon: Redo2, disabled: !s.canRedo, run: () => chain().redo().run() },
    ],
    [
      { id: 'h1', label: 'Título 1', shortcut: 'Ctrl+Alt+1', text: 'T1', active: s.h1, run: () => chain().toggleHeading({ level: 1 }).run() },
      { id: 'h2', label: 'Título 2', shortcut: 'Ctrl+Alt+2', text: 'T2', active: s.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { id: 'h3', label: 'Título 3', shortcut: 'Ctrl+Alt+3', text: 'T3', active: s.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { id: 'bold', label: 'Negrito', shortcut: 'Ctrl+B', icon: Bold, active: s.bold, run: () => chain().toggleBold().run() },
      { id: 'italic', label: 'Itálico', shortcut: 'Ctrl+I', icon: Italic, active: s.italic, run: () => chain().toggleItalic().run() },
      { id: 'underline', label: 'Sublinhado', shortcut: 'Ctrl+U', icon: UnderlineIcon, active: s.underline, run: () => chain().toggleUnderline().run() },
      { id: 'strike', label: 'Tachado', shortcut: 'Ctrl+Shift+S', icon: Strikethrough, active: s.strike, run: () => chain().toggleStrike().run() },
    ],
    [
      { id: 'bullet', label: 'Lista com marcadores', shortcut: 'Ctrl+Shift+8', icon: List, active: s.bullet, run: () => chain().toggleBulletList().run() },
      { id: 'ordered', label: 'Lista numerada', shortcut: 'Ctrl+Shift+7', icon: ListOrdered, active: s.ordered, run: () => chain().toggleOrderedList().run() },
      { id: 'quote', label: 'Citação', shortcut: 'Ctrl+Shift+B', icon: Quote, active: s.quote, run: () => chain().toggleBlockquote().run() },
    ],
    [
      { id: 'code', label: 'Código em linha', shortcut: 'Ctrl+E', icon: Code, active: s.code, run: () => chain().toggleCode().run() },
      { id: 'codeBlock', label: 'Bloco de código', shortcut: 'Ctrl+Alt+C', icon: SquareCode, active: s.codeBlock, run: () => chain().toggleCodeBlock().run() },
      { id: 'link', label: 'Inserir link', shortcut: 'Ctrl+K', icon: LinkIcon, active: s.link, run: onLinkClick },
      { id: 'rule', label: 'Linha divisória', icon: Minus, run: () => chain().setHorizontalRule().run() },
    ],
  ];

  // Uma parada de Tab só; as setas andam entre os botões (padrão de barra de ferramentas).
  const ref = React.useRef<HTMLDivElement>(null);
  const [current, setCurrent] = React.useState('bold');
  const buttons = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const list = buttons();
    if (list.length === 0) return;
    const index = list.findIndex((b) => b === document.activeElement);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % list.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + list.length) % list.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = list.length - 1;
    event.preventDefault();
    list[next]?.focus();
  };

  const currentExists = groups.flat().some((t) => t.id === current && !t.disabled);
  const tabStop = currentExists ? current : 'bold';

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Formatação"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        'flex w-full items-center gap-0.5 overflow-x-auto rounded-[14px] border border-border bg-card p-1.5 md:flex-wrap md:overflow-visible',
        'shadow-[0_6px_16px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.35)]',
        className,
      )}
    >
      {groups.map((group, gi) => (
        <span key={gi} className={cn('inline-flex shrink-0 items-center gap-0.5', gi < groups.length - 1 && 'mr-1 border-r border-border pr-1.5')}>
          {group.map((tool) => {
            const Icon = tool.icon;
            const title = tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label;
            return (
              <button
                key={tool.id}
                type="button"
                title={title}
                aria-label={tool.label}
                aria-pressed={tool.active === undefined ? undefined : tool.active}
                disabled={tool.disabled}
                tabIndex={tool.id === tabStop ? 0 : -1}
                onFocus={() => setCurrent(tool.id)}
                // Não rouba o foco nem a seleção do texto ao clicar.
                onMouseDown={(event) => event.preventDefault()}
                onClick={tool.run}
                className={cn(
                  'inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-bold transition-colors duration-fast',
                  'text-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40',
                  'aria-pressed:bg-primary/10 aria-pressed:text-primary dark:aria-pressed:bg-primary/15 [.theme-totvs:not(.dark)_&]:aria-pressed:text-foreground',
                  FOCUS_RING,
                )}
              >
                {Icon ? <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> : tool.text}
              </button>
            );
          })}
        </span>
      ))}
    </div>
  );
}
