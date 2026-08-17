import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
  type Firestore
} from 'firebase/firestore';

/** Limite de operações por batch no Firestore. */
const BATCH_LIMIT = 500;

export interface DeletePromptResult {
  /** Quantos comentários foram removidos junto com o item. */
  deletedComments: number;
}

/**
 * Exclui um item do Hub junto com o que pendura nele.
 *
 * O Firestore não faz exclusão em cascata: apagar o documento deixa a
 * subcoleção `comments` órfã e invisível — os documentos continuam no banco,
 * fora do alcance da interface e, depois da regra que amarra a leitura ao item
 * pai, fora do alcance de qualquer leitura.
 *
 * Ordem importa: os comentários precisam sair ANTES do item. A regra de
 * exclusão de comentário consulta o documento pai para autorizar o dono do
 * item; sem o pai, o `get()` falha e a exclusão passa a ser negada para sempre.
 */
export async function deletePromptWithChildren(
  firestore: Firestore,
  promptId: string,
  currentUserId?: string
): Promise<DeletePromptResult> {
  // 1. Comentários, em lotes, enquanto o item pai ainda existe.
  const commentsSnapshot = await getDocs(
    collection(firestore, 'prompt_hub', promptId, 'comments')
  );

  for (let i = 0; i < commentsSnapshot.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(firestore);
    commentsSnapshot.docs.slice(i, i + BATCH_LIMIT).forEach(commentDoc => {
      batch.delete(commentDoc.ref);
    });
    await batch.commit();
  }

  // 2. O favorito do próprio usuário. Os favoritos de terceiros vivem sob
  //    users/{outroUid}/ e são inacessíveis daqui por regra — limpá-los exige
  //    Cloud Function ou rotina administrativa.
  if (currentUserId) {
    try {
      await deleteDoc(doc(firestore, 'users', currentUserId, 'prompt_favorites', promptId));
    } catch (err) {
      console.warn('Não foi possível remover o favorito local do item excluído.', err);
    }
  }

  // 3. Por último, o item.
  await deleteDoc(doc(firestore, 'prompt_hub', promptId));

  return { deletedComments: commentsSnapshot.size };
}
