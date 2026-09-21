'use client';

import { CalendarClock } from 'lucide-react';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { useUserContext } from '@/context/UserContext';
import { DailyDigestPanel } from './DailyDigestPanel';

export default function DailyFlowPage() {
  const { userProfile } = useUserContext();
  const squadId = userProfile?.squadId || '';

  return (
    <ToolHubLayout
      title="Daily Digest com IA"
      description="Cole a nota que a daily já gera (ex: a do Google Meet) e receba o resumo por pessoa, bloqueios e action items — sem precisar reescrever nada na mão."
      icon={<CalendarClock />}
      themeColor="emerald"
      tips={[]}
      referenceSections={[]}
      onlyChildren={true}
    >
      {squadId ? (
        <DailyDigestPanel squadId={squadId} />
      ) : (
        <p className="text-sm text-slate-500 p-6">Entre com um squad selecionado para usar o Daily Digest.</p>
      )}
    </ToolHubLayout>
  );
}
