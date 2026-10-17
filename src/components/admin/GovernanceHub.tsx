'use client';

import React from 'react';
import { JiraSyncPanel } from '@/components/admin/JiraSyncPanel';

// Gestão de roster/membros de squad mudou de casa: agora vive em /squad/roster,
// com gate de negócio (Agile Master/Tech Lead/etc), não mais atrás do admin de
// sistema. Aqui fica só a Sincronização Jira: importar o time de um projeto com o
// token pessoal de quem consulta (nada vale para a organização inteira).
// O título da aba vem do cabeçalho do admin; este componente só traz o conteúdo.
export function GovernanceHub() {
  return (
    <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
      <JiraSyncPanel onSyncSuccess={() => {}} />
    </div>
  );
}
