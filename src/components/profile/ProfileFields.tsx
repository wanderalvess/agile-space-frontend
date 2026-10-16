'use client';

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLES } from '@/lib/types';
import type { GlobalRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FIELD_INPUT, FIELD_SELECT, Field, FieldError, SELECT_ITEM } from './fields';
import type { Option } from './useSquadOptions';

export interface ProfileErrors {
  name?: string;
  role?: string;
  project?: string;
}

export interface ProfileFieldsProps {
  name: string;
  onName: (v: string) => void;
  nameInput: React.Ref<HTMLInputElement>;
  email: string;
  onEmail: (v: string) => void;
  emailReadOnly: boolean;
  role: GlobalRole | '';
  onRole: (v: GlobalRole) => void;
  roleTrigger: React.Ref<HTMLButtonElement>;
  projectId: string;
  onProject: (v: string) => void;
  projectTrigger: React.Ref<HTMLButtonElement>;
  customProject: string;
  onCustomProject: (v: string) => void;
  isCustomProject: boolean;
  squadId: string;
  onSquad: (v: string) => void;
  customSquad: string;
  onCustomSquad: (v: string) => void;
  isCustomSquad: boolean;
  projects: Option[];
  squads: Option[];
  isSquadsLoaded: boolean;
  /** Conta já vinculada: projeto e squad só trocam pelo seletor do topo da tela. */
  locked: boolean;
  errors: ProfileErrors;
}

const LOCK_HINT = 'Troque pelo seletor de projeto no topo da tela';

/** Aba "Perfil": nome, e-mail, papel, projeto e squad. As regras de projeto/squad são as de sempre. */
export function ProfileFields({ nameInput, roleTrigger, projectTrigger, ...p }: ProfileFieldsProps) {
  const projectValue = p.projects.some((x) => x.id === p.projectId) ? p.projectId : p.projectId ? 'other' : '';
  const squadValue = p.squads.some((x) => x.id === p.squadId) ? p.squadId : p.squadId === 'other' ? 'other' : 'none';
  const squadDisabled = p.locked || !p.projectId || (p.squads.length === 0 && p.projectId !== 'other');

  return (
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
        <input
          id="identity-email"
          type="email"
          value={p.email}
          onChange={(e) => p.onEmail(e.target.value)}
          readOnly={p.emailReadOnly}
          autoComplete="off"
          placeholder="nome@empresa.com"
          className={FIELD_INPUT}
        />
      </Field>

      <Field htmlFor="identity-role" label="Papel">
        <Select value={p.role} onValueChange={(v: GlobalRole) => p.onRole(v)}>
          <SelectTrigger
            id="identity-role"
            ref={roleTrigger}
            aria-invalid={!!p.errors.role}
            aria-describedby={p.errors.role ? 'identity-role-error' : undefined}
            className={FIELD_SELECT}
          >
            <SelectValue placeholder="Selecione o papel" />
          </SelectTrigger>
          <SelectContent className="max-h-[260px] rounded-xl border-border">
            {ROLES.map((r) => (
              <SelectItem key={r} value={r} className={SELECT_ITEM}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id="identity-role-error">{p.errors.role}</FieldError>
      </Field>

      <Field htmlFor="identity-project" label="Projeto">
        <Select
          disabled={p.locked}
          value={projectValue}
          onValueChange={(v) => p.onProject(v)}
        >
          <SelectTrigger
            id="identity-project"
            ref={projectTrigger}
            title={p.locked ? LOCK_HINT : undefined}
            aria-invalid={!!p.errors.project}
            aria-describedby={p.errors.project ? 'identity-project-error' : undefined}
            className={FIELD_SELECT}
          >
            <SelectValue placeholder="Selecione o projeto" />
          </SelectTrigger>
          <SelectContent className="max-h-[260px] rounded-xl border-border">
            {!p.isSquadsLoaded && (
              <SelectItem value="loading" disabled className={cn(SELECT_ITEM, 'text-muted-foreground')}>
                Carregando projetos
              </SelectItem>
            )}
            {p.isSquadsLoaded &&
              p.projects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id} className={SELECT_ITEM}>
                  {proj.name}
                </SelectItem>
              ))}
            <SelectItem value="other" className={cn(SELECT_ITEM, 'mt-1 border-t border-border font-semibold')}>
              Outro projeto
            </SelectItem>
          </SelectContent>
        </Select>
        <FieldError id="identity-project-error">{p.errors.project}</FieldError>
      </Field>

      <Field htmlFor="identity-squad" label="Squad">
        <Select disabled={squadDisabled} value={squadValue} onValueChange={(v) => p.onSquad(v)}>
          <SelectTrigger id="identity-squad" title={p.locked ? LOCK_HINT : undefined} className={FIELD_SELECT}>
            <SelectValue
              placeholder={!p.projectId ? 'Escolha o projeto antes' : p.squads.length === 0 ? 'Sem squad' : 'Selecione a squad'}
            />
          </SelectTrigger>
          <SelectContent className="max-h-[260px] rounded-xl border-border">
            <SelectItem value="none" className={cn(SELECT_ITEM, 'text-muted-foreground')}>
              Sem squad (projeto único)
            </SelectItem>
            {p.squads.map((sq) => (
              <SelectItem key={sq.id} value={sq.id} className={SELECT_ITEM}>
                {sq.name}
              </SelectItem>
            ))}
            <SelectItem value="other" className={cn(SELECT_ITEM, 'mt-1 border-t border-border font-semibold')}>
              Outra squad
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {p.isCustomProject && !p.locked && (
        <Field htmlFor="identity-custom-project" label="Nome do projeto">
          <input
            id="identity-custom-project"
            value={p.customProject}
            onChange={(e) => p.onCustomProject(e.target.value)}
            autoComplete="off"
            placeholder="Nome do projeto"
            className={FIELD_INPUT}
          />
        </Field>
      )}

      {p.isCustomSquad && !p.locked && (
        <Field htmlFor="identity-custom-squad" label="Nome da squad">
          <input
            id="identity-custom-squad"
            value={p.customSquad}
            onChange={(e) => p.onCustomSquad(e.target.value)}
            autoComplete="off"
            placeholder="Nome da squad"
            className={FIELD_INPUT}
          />
        </Field>
      )}
    </div>
  );
}
