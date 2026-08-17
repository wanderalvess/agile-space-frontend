import { useCallback, useRef, useInsertionEffect } from 'react';

/**
 * Retorna uma função com identidade estável entre renders que sempre chama a
 * versão mais recente de `fn` — sem nunca usar closure velha. Usado pra
 * passar handlers como prop pra componentes memoizados (React.memo) sem que
 * a recriação do handler a cada render (ex: um deps array com estado que
 * muda a cada voto) invalide o memo e force re-render da árvore inteira.
 */
export function useStableCallback<Args extends unknown[], Return>(
  fn: (...args: Args) => Return
): (...args: Args) => Return {
  const fnRef = useRef(fn);
  useInsertionEffect(() => {
    fnRef.current = fn;
  });
  return useCallback((...args: Args) => fnRef.current(...args), []);
}
