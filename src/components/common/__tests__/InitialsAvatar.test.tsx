import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InitialsAvatar } from '../InitialsAvatar';

describe('InitialsAvatar', () => {
  it('mostra as iniciais quando não há foto', () => {
    render(<InitialsAvatar name="Ana Paula Ribeiro" />);
    expect(screen.getByText('AR')).toBeTruthy();
  });

  it('usa o e-mail quando falta o nome', () => {
    render(<InitialsAvatar email="carlos.souza@totvs.com.br" />);
    expect(screen.getByText('CS')).toBeTruthy();
  });

  it('mostra a foto quando existe', () => {
    const { container } = render(<InitialsAvatar name="Ana Ribeiro" src="https://jira.example/a.png" />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://jira.example/a.png');
    expect(screen.queryByText('AR')).toBeNull();
  });

  it('volta para as iniciais quando a foto não carrega e avisa qual falhou', () => {
    const onPhotoError = vi.fn();
    const { container } = render(<InitialsAvatar name="Ana Ribeiro" src="https://jira.example/quebrada.png" onPhotoError={onPhotoError} />);
    fireEvent.error(container.querySelector('img')!);
    expect(onPhotoError).toHaveBeenCalledWith('https://jira.example/quebrada.png');
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('AR')).toBeTruthy();
  });

  it('tenta de novo quando a foto muda depois de uma falha', () => {
    const { container, rerender } = render(<InitialsAvatar name="Ana Ribeiro" src="https://jira.example/1.png" />);
    fireEvent.error(container.querySelector('img')!);
    rerender(<InitialsAvatar name="Ana Ribeiro" src="https://jira.example/2.png" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://jira.example/2.png');
  });

  it('é decorativo sem título e vira imagem com título', () => {
    const { container, rerender } = render(<InitialsAvatar name="Ana Ribeiro" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    rerender(<InitialsAvatar name="Ana Ribeiro" title="Ana Ribeiro" />);
    expect(screen.getByRole('img', { name: 'Ana Ribeiro' })).toBeTruthy();
  });

  it('aplica um tom estável por pessoa e o tamanho de quem chama', () => {
    const a = render(<InitialsAvatar name="Ana Ribeiro" className="h-12 w-12" />).container.firstElementChild!;
    const b = render(<InitialsAvatar name="Ana Ribeiro" />).container.firstElementChild!;
    const tone = (el: Element) => Array.from(el.classList).find((c) => c.startsWith('avatar-tone-'));
    expect(tone(a)).toBeTruthy();
    expect(tone(a)).toBe(tone(b));
    expect(a.classList.contains('h-12')).toBe(true);
    expect(a.classList.contains('h-8')).toBe(false);
    expect(a.classList.contains('font-semibold')).toBe(true);
  });
});
