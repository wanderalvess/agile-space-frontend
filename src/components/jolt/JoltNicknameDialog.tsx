
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
import { User, Pencil } from 'lucide-react';

interface JoltNicknameDialogProps {
  onNameSubmit: (name: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  isInitialSetup?: boolean;
}

export function JoltNicknameDialog({ onNameSubmit, open, onOpenChange, initialName, isInitialSetup = false }: JoltNicknameDialogProps) {
  const [nickname, setNickname] = useState(initialName || '');

  useEffect(() => {
    if (open) {
      setNickname(initialName || '');
    }
  }, [open, initialName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) {
      onNameSubmit(nickname.trim());
    }
  };

  const handleInteractOutside = (e: Event) => {
    if (isInitialSetup) {
      e.preventDefault();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={handleInteractOutside}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isInitialSetup ? 'Identificação do Analista' : 'Mudar seu nome'}</DialogTitle>
            <DialogDescription>
              {isInitialSetup 
                ? 'Para salvar e carregar layouts, informe seu nome ou apelido. Isso ajudará a identificar quem criou cada teste.' 
                : 'Seu novo nome será exibido nos layouts que você salvar a partir de agora.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nome
              </Label>
              <Input
                id="name"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="col-span-3"
                placeholder="Seu nome..."
                required
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!nickname.trim()}>
              {isInitialSetup ? <User className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
              {isInitialSetup ? 'Acessar Sandbox' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
