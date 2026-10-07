'use client';

import { useEffect } from 'react';
import { Target } from 'lucide-react';
import { ComingSoon } from '@/components/shared/ComingSoon';

export default function SprintPlannerPage() {
  useEffect(() => {
    document.title = 'Planejador de Entregas | Portal Tech V&D';
  }, []);

  return (
    <ComingSoon
      title="Planejador de Entregas"
      icon={<Target />}
      description="Capacidade do time e planejamento de sprint, depois do Scrum Poker. Estamos redesenhando este módulo para o novo padrão do Portal Tech V&D."
    />
  );
}
