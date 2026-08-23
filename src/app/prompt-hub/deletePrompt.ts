import { promptApi } from '@/app/prompt-hub/api';

/**
 * Exclui um item do Hub.
 *
 * No Firestore, apagar o documento deixava a subcoleção `comments` órfã (sem
 * exclusão em cascata nativa), então o frontend precisava apagar os
 * comentários manualmente antes do item pai. No backend Spring/Postgres isso
 * é responsabilidade do próprio serviço: `PromptService#deletePrompt` remove
 * os comentários associados antes de deletar o prompt (limpeza feita na
 * camada de aplicação — não há `ON DELETE CASCADE` configurado no schema).
 * O frontend só precisa chamar o endpoint de exclusão.
 */
export async function deletePromptWithChildren(promptId: string): Promise<void> {
  await promptApi.deletePrompt(promptId);
}
