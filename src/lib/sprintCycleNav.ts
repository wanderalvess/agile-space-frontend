import type { useRouter } from 'next/navigation';
import { retroApi } from '@/app/retro/api';
import { actionPlanApi } from '@/app/action-plan/api';

type Router = ReturnType<typeof useRouter>;

// Navega pro board (retro/action-plan) já existente pra essa sprint, ou pra tela
// de criação com sprintId/squad pré-preenchidos via querystring, caso não exista.
// sprintId é o id de sprint do Jira (mesmo espaço de Squad.activeSprintId /
// WorkItem.sprintId) — não há tabela Sprint dedicada, é string livre.

export async function openOrCreateRetro(router: Router, sprintId: string, squadId?: string) {
  try {
    const boards = await retroApi.listBoards({ sprintId });
    const match = squadId ? boards.find(b => b.team === squadId) || boards[0] : boards[0];
    if (match) {
      router.push(`/retro/${match.id}`);
      return;
    }
  } catch (e) {
    console.error('[sprintCycleNav] falha ao buscar retro existente', e);
  }
  const qs = new URLSearchParams({ sprintId, ...(squadId ? { squad: squadId } : {}) });
  router.push(`/retro?${qs.toString()}`);
}

export async function openOrCreateActionPlan(router: Router, sprintId: string, squadId?: string) {
  try {
    const boards = await actionPlanApi.listBoards(sprintId);
    const match = squadId ? boards.find(b => b.team === squadId) || boards[0] : boards[0];
    if (match) {
      router.push(`/action-plan/${match.id}`);
      return;
    }
  } catch (e) {
    console.error('[sprintCycleNav] falha ao buscar plano de ação existente', e);
  }
  const qs = new URLSearchParams({ sprintId, ...(squadId ? { squad: squadId } : {}) });
  router.push(`/action-plan?${qs.toString()}`);
}
