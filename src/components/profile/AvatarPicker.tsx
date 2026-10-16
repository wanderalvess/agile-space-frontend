'use client';

import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { AVATAR_SEEDS, PREDEFINED_AVATARS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/components/room-kit';
import { FIELD_LABEL } from './fields';

/** Grade de avatares ilustrados. Só aparece para quem não tem foto do Jira. */
export function AvatarPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (seed: string) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-labelledby="identity-avatar-label" className={cn('flex flex-col gap-2', className)}>
      <span id="identity-avatar-label" className={FIELD_LABEL}>
        Avatar
      </span>
      <div className="grid grid-cols-4 gap-2 max-md:grid-cols-5">
        {AVATAR_SEEDS.map((seed, index) => {
          const selected = value === seed;
          return (
            <button
              key={seed}
              type="button"
              aria-pressed={selected}
              aria-label={`Avatar ${index + 1}`}
              onClick={() => onChange(seed)}
              className={cn(
                'aspect-square min-h-11 w-full overflow-hidden rounded-full border-2 transition-[border-color,box-shadow,opacity] duration-fast motion-reduce:transition-none',
                FOCUS_RING,
                selected
                  ? 'border-primary opacity-100 shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]'
                  : 'border-transparent opacity-70 hover:opacity-100'
              )}
            >
              <NiceAvatar aria-hidden="true" className="h-full w-full" {...(PREDEFINED_AVATARS[seed] || genConfig(seed))} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
