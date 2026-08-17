"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { User, LogIn, Pencil } from 'lucide-react';
import { TeamRole, TEAM_ROLE_DESCRIPTIONS } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface EliteNicknameDialogProps {
  onSubmit: (details: { nickname: string; role: TeamRole }) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialRole?: TeamRole;
  isInitialSetup?: boolean;
  title?: string;
  description?: string;
  theme?: 'primary' | 'amber' | 'emerald' | 'rose';
}

const ALL_ROLES = Object.keys(TEAM_ROLE_DESCRIPTIONS) as TeamRole[];

const THEME_STYLES = {
  primary: {
    bgRound: 'bg-primary/10',
    iconColor: 'text-primary',
    btnHover: 'shadow-primary/20 hover:bg-orange-600',
    btnBg: 'bg-primary'
  },
  amber: {
    bgRound: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
    btnHover: 'shadow-amber-500/20 hover:bg-amber-600',
    btnBg: 'bg-amber-500'
  },
  emerald: {
    bgRound: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
    btnHover: 'shadow-emerald-500/20 hover:bg-emerald-600',
    btnBg: 'bg-emerald-500'
  },
  rose: {
    bgRound: 'bg-rose-500/10',
    iconColor: 'text-rose-600',
    btnHover: 'shadow-rose-500/20 hover:bg-rose-600',
    btnBg: 'bg-rose-500'
  }
};

export function EliteNicknameDialog({ 
  onSubmit, 
  open, 
  onOpenChange, 
  initialName, 
  initialRole, 
  isInitialSetup = false,
  title,
  description,
  theme = 'primary'
}: EliteNicknameDialogProps) {
  const [nickname, setNickname] = useState(initialName || '');
  const [role, setRole] = useState<TeamRole | ''>(initialRole || '');

  useEffect(() => {
    if (open) {
      setNickname(initialName || '');
      setRole(initialRole || '');
    }
  }, [open, initialName, initialRole]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim() && role) {
      onSubmit({ nickname: nickname.trim(), role: role as TeamRole });
    }
  };

  const handleInteractOutside = (e: Event) => {
    if (isInitialSetup) {
      e.preventDefault();
    }
  };

  const styles = THEME_STYLES[theme];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl" onInteractOutside={handleInteractOutside}>
        <div className="bg-muted/10 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <DialogHeader>
              <div className={cn("mx-auto p-3 rounded-full w-fit mb-4", styles.bgRound)}>
                <User className={cn("h-8 w-8", styles.iconColor)} />
              </div>
              <DialogTitle className="text-center text-2xl font-black uppercase tracking-tight">
                {title || (isInitialSetup ? 'Bem-vindo ao Setup!' : 'Editar Perfil')}
              </DialogTitle>
              <DialogDescription className="text-center">
                {description || (isInitialSetup 
                  ? 'Informe seu nome e papel para entrar na sessão.' 
                  : 'Atualize suas informações de identificação.')}
              </DialogDescription>
            </DialogHeader>

            <Card className="p-6 space-y-4 border-border/50 shadow-sm rounded-xl bg-card">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome Completo</Label>
                <Input
                  id="name"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="h-11 font-bold"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Seu Papel na Squad</Label>
                <Select value={role} onValueChange={(val: TeamRole) => setRole(val)}>
                  <SelectTrigger id="role" className="h-11 font-bold bg-background">
                    <SelectValue placeholder="Selecione seu papel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map(roleKey => {
                      const Icon = TEAM_ROLE_DESCRIPTIONS[roleKey].icon;
                      return (
                        <SelectItem key={roleKey} value={roleKey} className="font-medium">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", styles.iconColor)} />
                            <span>{TEAM_ROLE_DESCRIPTIONS[roleKey].name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            <DialogFooter>
              <Button type="submit" size="lg" className={cn("w-full h-12 font-black text-white uppercase tracking-widest rounded-xl shadow-lg transition-all text-xs", styles.btnHover, styles.btnBg)} disabled={!nickname.trim() || !role}>
                {isInitialSetup ? (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Entrar na Sessão
                  </>
                ) : (
                  <>
                    <Pencil className="mr-2 h-5 w-5" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
