'use client';

import * as React from 'react';
import Link from 'next/link';
import { Camera, ChevronRight, Palette, UserRound } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { FOCUS_RING, ModalButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { FIELD_INPUT, Field, FieldError } from './fields';
import { SectionCard, TEXT_ACTION } from './ui';

export interface ProfileErrors {
  name?: string;
}

export interface ProfileSectionProps {
  name: string;
  onName: (v: string) => void;
  nameInput: React.Ref<HTMLInputElement>;
  email: string;
  errors: ProfileErrors;
  /** Foto do Jira em uso (ou nada). */
  photo?: string;
  onPhotoError: (url: string) => void;
  /** Há foto do Jira que a pessoa pode usar (mesmo com as iniciais ligadas). */
  photoAvailable: boolean;
  photoOff: boolean;
  onPhotoOff: (off: boolean) => void;
  onGoJira: () => void;
  /** Fecha o modal antes de seguir para outra página. */
  onNavigate: () => void;
}

/** Seção "Perfil": o que é da pessoa (nome editável, e-mail da conta), a foto e o atalho de aparência. */
export function ProfileSection({ nameInput, ...p }: ProfileSectionProps) {
  const photoState = p.photo ? 'Foto do Jira' : p.photoAvailable ? 'Iniciais do seu nome' : 'Sem foto';

  return (
    <div className="flex flex-col gap-4">
      <SectionCard icon={UserRound} title="Dados pessoais" titleId="identity-dados">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="identity-name" label="Nome">
            <input
              id="identity-name"
              ref={nameInput}
              value={p.name}
              onChange={(e) => p.onName(e.target.value)}
              autoComplete="off"
              placeholder="Seu nome"
              aria-invalid={!!p.errors.name}
              aria-describedby={p.errors.name ? 'identity-name-error' : undefined}
              className={FIELD_INPUT}
            />
            <FieldError id="identity-name-error">{p.errors.name}</FieldError>
          </Field>

          <Field htmlFor="identity-email" label="E-mail">
            <input id="identity-email" type="email" value={p.email} readOnly autoComplete="off" className={FIELD_INPUT} />
          </Field>
        </div>
      </SectionCard>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SectionCard icon={Camera} title="Foto" titleId="identity-foto">
          <div className="flex flex-wrap items-center gap-4">
            <InitialsAvatar name={p.name.trim()} email={p.email} src={p.photo} onPhotoError={p.onPhotoError} className="h-14 w-14 border border-border text-lg" />
            <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">{photoState}</span>
              {!p.photo && !p.photoAvailable && <span className="text-xs text-muted-foreground">Conecte o Jira para trazer a sua.</span>}
            </div>
            {(p.photo || p.photoAvailable) && (
              <ModalButton onClick={() => p.onPhotoOff(!p.photoOff)} className="max-sm:h-11 max-sm:w-full">
                {p.photoOff ? 'Usar foto do Jira' : 'Usar minhas iniciais'}
              </ModalButton>
            )}
            {!p.photo && !p.photoAvailable && (
              <button type="button" onClick={p.onGoJira} className={TEXT_ACTION}>
                Conectar o Jira
              </button>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={Palette} title="Aparência" titleId="identity-aparencia">
          <Link
            href="/configuracoes"
            onClick={p.onNavigate}
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent max-sm:min-h-11',
              FOCUS_RING,
            )}
          >
            Aparência e tema
            <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </Link>
        </SectionCard>
      </div>
    </div>
  );
}
