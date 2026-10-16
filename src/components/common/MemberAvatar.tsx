import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { cn } from '@/lib/utils';

interface MemberAvatarProps {
  name?: string;
  /** Foto do Jira (imagem embutida) ou qualquer URL; sem ela, mostra as iniciais. */
  src?: string | null;
  className?: string;
}

// Avatar de pessoa do time: foto quando existe, iniciais quando não (ou quando a imagem falha ao carregar).
export function MemberAvatar({ name, src, className }: MemberAvatarProps) {
  return <InitialsAvatar name={name} src={src} title={name} className={cn('h-8 w-8', className)} />;
}
