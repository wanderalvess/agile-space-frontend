// Sprints anteriores da mesma squad (mesmo board do Jira).
// Extraido de assets/js/jiradash.js sem alterar a regra: fail-closed de proposito.

// Sprints anteriores DA MESMA SQUAD, da mais recente pra mais antiga.
// "Mesma squad" = mesmo board do Jira (originBoardId). sprintId é GLOBAL entre boards,
// então ordenar por id sem filtrar por board faz a "sprint anterior" cair quase sempre
// em outra squad — foi exatamente isso que misturou times no doc compartilhado.
// Sem board resolvido (Jira fora, sprint sem acesso): lista vazia. Fail-closed de
// propósito — não herdar nada é melhor que herdar de outro time.
export const priorSprintIdsSameBoard = snap => {
  const { currentSprintId, currentBoardId, sprintBoards, sprintsByid } = snap || {};
  if (!currentSprintId || currentBoardId == null) return [];
  return Object.keys(sprintsByid || {})
    .filter(id => Number(id) < Number(currentSprintId))
    .filter(id => sprintBoards?.[id] === currentBoardId)
    .sort((a, b) => Number(b) - Number(a));
};
