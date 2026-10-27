'use client';

import * as React from 'react';
import { Palette, UserRound } from 'lucide-react';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { CargoRequestForm } from './CargoRequestForm';
import { FIELD_INPUT, Field, FieldError } from './fields';
import { PhotoSection } from './PhotoSection';
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
  userId?: string;
  /** Cargo em exibição (lib/cargo.ts); só leitura. Mudança passa pelo Suporte. */
  cargo?: string;
  /** Liderança vem do Jira/convite: o cargo desejado do pedido é opcional. */
  leadership: boolean;
  /** Squad ativa, para o corpo do pedido ao Suporte. */
  squad?: string;
  /** Foto em uso (enviada ou do Jira), ou nada. */
  photo?: string;
  hasUploaded: boolean;
  onPhotoError: (url: string) => void;
  /** Há foto do Jira que a pessoa pode usar (mesmo com as iniciais ligadas). */
  photoAvailable: boolean;
  photoOff: boolean;
  onPhotoOff: (off: boolean) => void;
  onGoJira: () => void;
  /** Fecha o modal antes de seguir para outra página. */
  onNavigate: () => void;
}

/** Seção "Perfil": dados da pessoa (nome editável; e-mail e cargo em leitura), foto e aparência. */
export function ProfileSection({ nameInput, ...p }: ProfileSectionProps) {
  const [requestingCargo, setRequestingCargo] = React.useState(false);

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

          <Field htmlFor="identity-cargo" label="Cargo" className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <input
                id="identity-cargo"
                value={p.cargo || ''}
                placeholder="Sem cargo definido"
                readOnly
                autoComplete="off"
                className={`${FIELD_INPUT} min-w-0 flex-1 basis-48`}
              />
              {!requestingCargo && (
                <button type="button" onClick={() => setRequestingCargo(true)} className={TEXT_ACTION}>
                  Pedir ajuste do cargo
                </button>
              )}
            </div>
          </Field>
        </div>
        {requestingCargo && (
          <CargoRequestForm
            currentCargo={p.cargo}
            email={p.email}
            name={p.name}
            squad={p.squad}
            leadership={p.leadership}
            onClose={() => setRequestingCargo(false)}
            onNavigate={p.onNavigate}
          />
        )}
      </SectionCard>

      <PhotoSection
        userId={p.userId}
        name={p.name}
        email={p.email}
        photo={p.photo}
        onPhotoError={p.onPhotoError}
        hasUploaded={p.hasUploaded}
        photoAvailable={p.photoAvailable}
        photoOff={p.photoOff}
        onPhotoOff={p.onPhotoOff}
        onGoJira={p.onGoJira}
      />

      <SectionCard icon={Palette} title="Aparência" titleId="identity-aparencia">
        <ThemeSettings idPrefix="identity-theme" compact />
      </SectionCard>
    </div>
  );
}
