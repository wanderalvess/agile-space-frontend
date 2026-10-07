import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

function initials(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface MemberAvatarProps {
  name?: string;
  /** Foto do Jira (imagem embutida) ou qualquer URL; sem ela, mostra as iniciais. */
  src?: string | null;
  className?: string;
  fallbackClassName?: string;
}

// Avatar de pessoa do time: foto quando existe, iniciais quando não (ou quando a imagem falha ao carregar).
export function MemberAvatar({ name, src, className, fallbackClassName }: MemberAvatarProps) {
  return (
    <Avatar className={cn('h-8 w-8', className)} title={name}>
      {src ? <AvatarImage src={src} alt={name ? `Foto de ${name}` : ''} className="object-cover" /> : null}
      <AvatarFallback className={cn('bg-muted text-[10px] font-bold text-muted-foreground', fallbackClassName)}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
