'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { getAuth } from 'firebase/auth';
import { getApps } from 'firebase/app';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries.
 * 
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *  
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query. Waits if null/undefined.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
    options?: { silent?: boolean }
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let unsubscribe: () => void = () => {};
    
    try {
      unsubscribe = onSnapshot(
        memoizedTargetRefOrQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const results: ResultItemType[] = [];
          for (const doc of snapshot.docs) {
            results.push({ ...(doc.data() as T), id: doc.id });
          }
          setData(results);
          setError(null);
          setIsLoading(false);
        },
        (error: FirestoreError) => {
          // 1. Extração Segura do Path
          let path = 'unknown';
          try {
            if (memoizedTargetRefOrQuery) {
              if ((memoizedTargetRefOrQuery as any).path) {
                path = (memoizedTargetRefOrQuery as any).path;
              } else if ((memoizedTargetRefOrQuery as any)._query && (memoizedTargetRefOrQuery as any)._query.path) {
                path = (memoizedTargetRefOrQuery as any)._query.path.canonicalString();
              } else {
                path = '[query-without-detectable-path]';
              }
            }
          } catch (e) {
            path = '[error-extracting-path]';
          }

          // 2. Blindagem contra Circularidade (Window/Circular structure)
          // Criamos um novo erro "limpo" para evitar que a SDK tente serializar o objeto original circular
          // que pode conter referências ao 'window' ou à raiz da aplicação.
          const cleanError = new Error(error.message || 'Firestore query failed');
          (cleanError as any).code = error.code || 'unknown';
          (cleanError as any).path = path;

          // Só chamamos de erro de permissão o que realmente é. Antes, qualquer
          // falha (índice ausente, indisponibilidade, query inválida) era
          // reembalada como "denied by Firestore Security Rules" e mandava quem
          // estava depurando para o lado errado.
          const isPermissionDenied = error.code === 'permission-denied';

          const contextualError = isPermissionDenied
            ? new FirestorePermissionError({ operation: 'list', path })
            : cleanError;

          setError(contextualError);
          setData(null);
          setIsLoading(false);

          // Check if user is authenticated. If not, silence the error as it is a normal transition (like logout).
          let isUserSignedIn = false;
          try {
            if (getApps().length > 0) {
              const authInstance = getAuth();
              isUserSignedIn = !!authInstance.currentUser;
            }
          } catch (e) {
            // Default to false if auth not initialized
          }

          // 3. Emissão Global segura (apenas se o usuário estiver logado no Firebase)
          if (isUserSignedIn) {
            if (isPermissionDenied) {
              errorEmitter.emit('permission-error', contextualError as FirestorePermissionError);
            }

            errorEmitter.emit('firestore-error', {
              code: (cleanError as any).code,
              message: cleanError.message,
              path,
              operation: 'list',
              notifyUser: !options?.silent && !isPermissionDenied
            });
          }
        }
      );
    } catch (e) {
      console.error("Firestore onSnapshot failed:", e);
    }

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [memoizedTargetRefOrQuery]); // Re-run if the target query/reference changes.
  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }
  return { data, isLoading, error };
}