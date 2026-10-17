import type { Editor } from '@tiptap/react';
import type { LinkDialogValue } from './LinkDialog';

/**
 * Ponto de partida da janela "Inserir link": se o cursor está num link, seleciona o trecho inteiro do link
 * e devolve endereço e texto dele; se há texto selecionado, devolve o texto; senão, vazio.
 */
export function readLinkContext(editor: Editor): { initial: LinkDialogValue; hasLink: boolean } {
  const hasLink = editor.isActive('link');
  if (hasLink) editor.chain().extendMarkRange('link').run();
  const { from, to, empty } = editor.state.selection;
  const text = empty ? '' : editor.state.doc.textBetween(from, to, ' ');
  const href = hasLink ? String(editor.getAttributes('link').href ?? '') : '';
  return { initial: { href, text }, hasLink };
}

/** Aplica o link: marca a seleção, ou troca/insere o texto quando ele mudou (ou não havia seleção). */
export function applyLink(editor: Editor, { href, text }: LinkDialogValue): void {
  const { from, to, empty } = editor.state.selection;
  const selected = empty ? '' : editor.state.doc.textBetween(from, to, ' ');
  const label = text || selected || href;
  if (empty || label !== selected) {
    editor
      .chain()
      .focus()
      .insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] })
      .run();
  } else {
    editor.chain().focus().setLink({ href }).run();
  }
}

export function removeLink(editor: Editor): void {
  editor.chain().focus().extendMarkRange('link').unsetLink().run();
}
