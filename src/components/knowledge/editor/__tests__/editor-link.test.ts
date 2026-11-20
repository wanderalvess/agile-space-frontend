import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { applyLink, readLinkContext, removeLink } from '../editor-link';

let editor: Editor | null = null;

function make(content: string) {
  editor = new Editor({ extensions: [StarterKit.configure({ link: { openOnClick: false } })], content });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** Posição do primeiro caractere do texto dentro do documento. */
function posOf(e: Editor, needle: string): number {
  let found = -1;
  e.state.doc.descendants((node, pos) => {
    if (found === -1 && node.isText && node.text?.includes(needle)) found = pos + (node.text.indexOf(needle));
    return found === -1;
  });
  return found;
}

describe('link no editor', () => {
  it('lê o endereço e o texto quando o cursor está dentro de um link', () => {
    const e = make('<p>Veja o <a href="https://tdn.totvs.com/">glossário do Jolt</a> hoje.</p>');
    e.commands.setTextSelection(posOf(e, 'glossário') + 3);
    const ctx = readLinkContext(e);
    expect(ctx.hasLink).toBe(true);
    expect(ctx.initial).toEqual({ href: 'https://tdn.totvs.com/', text: 'glossário do Jolt' });
  });

  it('com texto selecionado e sem link, devolve o texto e hasLink falso', () => {
    const e = make('<p>Manual de uso</p>');
    const from = posOf(e, 'Manual');
    e.commands.setTextSelection({ from, to: from + 6 });
    expect(readLinkContext(e)).toEqual({ initial: { href: '', text: 'Manual' }, hasLink: false });
  });

  it('aplica o link na seleção sem mudar o texto', () => {
    const e = make('<p>Manual de uso</p>');
    const from = posOf(e, 'Manual');
    e.commands.setTextSelection({ from, to: from + 6 });
    applyLink(e, { href: 'https://tdn.totvs.com', text: '' });
    expect(e.getHTML()).toContain('<a target="_blank" rel="noopener noreferrer nofollow" href="https://tdn.totvs.com">Manual</a> de uso');
  });

  it('troca o texto da seleção quando o texto do link é outro', () => {
    const e = make('<p>Manual de uso</p>');
    const from = posOf(e, 'Manual');
    e.commands.setTextSelection({ from, to: from + 6 });
    applyLink(e, { href: 'https://tdn.totvs.com', text: 'Guia' });
    expect(e.getText()).toBe('Guia de uso');
    expect(e.getHTML()).toContain('>Guia</a>');
  });

  it('sem seleção insere o texto (ou o próprio endereço) já com o link', () => {
    const e = make('<p>Fim</p>');
    e.commands.setTextSelection(1);
    applyLink(e, { href: 'mailto:ana@totvs.com.br', text: '' });
    expect(e.getHTML()).toContain('>mailto:ana@totvs.com.br</a>');
  });

  it('remove o link inteiro e mantém o texto', () => {
    const e = make('<p>Veja <a href="https://tdn.totvs.com/">o glossário</a>.</p>');
    e.commands.setTextSelection(posOf(e, 'glossário') + 2);
    readLinkContext(e);
    removeLink(e);
    expect(e.getHTML()).toBe('<p>Veja o glossário.</p>');
  });
});
