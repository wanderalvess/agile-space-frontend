import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from '../copy-to-clipboard';

/**
 * Sem HTTPS (acesso interno por IP) `navigator.clipboard` não existe e o helper cai no execCommand. Dentro de um modal do
 * Radix o foco fica preso no diálogo: um textarea anexado ao <body> não recebe foco e a cópia falha. O fallback precisa
 * anexar o textarea DENTRO do diálogo aberto.
 */
describe('copyToClipboard (fallback sem Clipboard API)', () => {
  let execCommand: ReturnType<typeof vi.fn>;
  let attachedTo: Element | null;

  beforeEach(() => {
    vi.stubGlobal('isSecureContext', false);
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    attachedTo = null;
    execCommand = vi.fn(() => {
      attachedTo = document.querySelector('textarea')?.parentElement ?? null;
      return true;
    });
    (document as unknown as { execCommand: unknown }).execCommand = execCommand;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('copia pelo body quando não há diálogo aberto e remove o textarea depois', async () => {
    await expect(copyToClipboard('texto')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(attachedTo).toBe(document.body);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('anexa o textarea dentro do diálogo aberto para o foco não ficar preso fora dele', async () => {
    document.body.innerHTML = '<div role="dialog" data-state="open" id="dlg"><button id="b">ok</button></div>';
    await expect(copyToClipboard('chave-secreta')).resolves.toBe(true);
    expect(attachedTo).toBe(document.getElementById('dlg'));
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('devolve false quando o execCommand falha, sem deixar lixo no DOM', async () => {
    execCommand.mockReturnValue(false);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(copyToClipboard('x')).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
    spy.mockRestore();
  });
});
