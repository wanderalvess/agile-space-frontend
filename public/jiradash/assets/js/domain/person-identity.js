// Observação de identidade EM SESSÃO — CP2 da épica "Implementar identidade e roster v2" (#7).
//
// O Jira já entrega, em cada assignee e autor de worklog, o objeto de usuário com `key`,
// `name`, `displayName` e `active`; o app lia só o displayName e descartava o resto. Este
// módulo preserva essas observações EM MEMÓRIA, paralelas às estruturas legadas — que
// continuam chaveadas por displayName, byte a byte como antes.
//
// Regras do CP2 (plano aprovado):
//   - key/name/displayName/active preservados EXATAMENTE como observados: sem lowercase,
//     sem trim, sem remoção de [X] — [X] é apresentação, nunca identidade.
//   - `active` ausente é DESCONHECIDO (null), nunca false.
//   - key presente → referência externa utilizável SOMENTE em sessão; sem key com name →
//     observação PROVISÓRIA de sessão; sem ambos → nada utilizável nem persistível (só conta).
//   - Mesma key CONVERGE (assignee + autor de worklog); keys diferentes NUNCA são unidas por
//     igualdade de name/displayName — e provisórias nunca são unidas, nem entre si.
//   - O cliente NÃO cria personId (resolver/criar é invariante do servidor, CP3+); o key NÃO
//     vira chave de configuração, roster ou métrica.
//   - Só key/name/displayName/active são lidos: emailAddress, avatarUrls, self e timeZone
//     nunca são tocados.
//   - Nada disto vai para localStorage/sessionStorage, DOM, CSV, Retro, console ou log.
//
// Avaliação inerte: sem DOM, storage, state, fetch ou timer — o relógio só roda quando uma
// observação acontece, e é injetável em teste; nunca na avaliação do módulo.
//
// ⚠️ `observedAt` é o INSTANTE LOCAL em que o JiraDash processou a observação — não é, e não
// representa, a data de atualização do usuário no Jira. Na convergência por key vale a última
// observação processada (last-observation-wins), na ordem em que o pipeline as percorreu.

export const IDENTITY_PROVIDER = 'jira-server';

const defaultNow = () => new Date().toISOString();

function exactString(value) {
  return typeof value === 'string' ? value : null;
}

// Lê SOMENTE os quatro campos permitidos do objeto de usuário do Jira e monta a observação
// de sessão. Devolve null para user ausente/não-objeto (ex.: issue sem assignee).
export function observeJiraUser(user, observedAt) {
  if (typeof user !== 'object' || user === null || Array.isArray(user)) return null;
  const key = exactString(user.key);
  return {
    externalRef: key ? { provider: IDENTITY_PROVIDER, kind: 'key', value: key } : null,
    displayName: exactString(user.displayName),
    username: exactString(user.name),
    active: typeof user.active === 'boolean' ? user.active : null,
    observedAt
  };
}

// Registro de sessão por dataset: criado em buildDerived e pendurado em `derived.identity`.
// `byKey` converge observações da MESMA key; `provisional` guarda, SEM unir, as observações
// com name e sem key; observação sem key e sem name só incrementa `stats.unusableObservations`
// — nenhum valor dela é retido.
export function createIdentityRegistry({ now = defaultNow } = {}) {
  const byKey = new Map();
  const provisional = [];
  const stats = { keyObservations: 0, provisionalObservations: 0, unusableObservations: 0 };
  return {
    byKey,
    provisional,
    stats,
    observe(user, source) {
      const obs = observeJiraUser(user, now());
      if (!obs) return null;
      if (obs.externalRef) {
        stats.keyObservations += 1;
        const id = obs.externalRef.value; // key EXATA: case-sensitive, sem trim
        const entry = byKey.get(id);
        if (entry) {
          // Convergência POR KEY: a ÚLTIMA OBSERVAÇÃO PROCESSADA vence + fontes acumuladas.
          entry.displayName = obs.displayName;
          entry.username = obs.username;
          entry.active = obs.active;
          entry.observedAt = obs.observedAt;
          entry.sources.add(source);
          entry.observations += 1;
        } else {
          byKey.set(id, { ...obs, sources: new Set([source]), observations: 1 });
        }
        return obs;
      }
      if (obs.username) {
        // PROVISÓRIA: só sessão, nunca unida a nada — nem a outra provisória de mesmo name.
        stats.provisionalObservations += 1;
        provisional.push({ ...obs, source });
        return obs;
      }
      // Sem key e sem name: não há identidade utilizável nem persistível — só a contagem.
      stats.unusableObservations += 1;
      return null;
    }
  };
}
