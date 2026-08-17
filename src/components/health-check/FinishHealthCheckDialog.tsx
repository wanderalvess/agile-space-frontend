'use client';

import { useState } from 'react';
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
import { CheckSquare, Loader2 } from 'lucide-react';

interface FinishHealthCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (title: string) => void;
  isFinishing: boolean;
}

export function FinishHealthCheckDialog({ open, onOpenChange, onConfirm, isFinishing }: FinishHealthCheckDialogProps) {
  const [title, setTitle] = useState('');

  const handleSubmit = () => {
    onConfirm(title.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Finalizar Rodada de Votação</DialogTitle>
          <DialogDescription>
            A votação será encerrada e os resultados processados. Se desejar, adicione um título para esta rodada (ex: "Fim da Sprint 12").
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Título (Opcional)
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              placeholder="Título da rodada..."
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isFinishing}>
            Cancelar
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isFinishing}>
            {isFinishing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckSquare className="mr-2 h-4 w-4" />
            )}
            {isFinishing ? 'Finalizando...' : 'Confirmar e Finalizar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
