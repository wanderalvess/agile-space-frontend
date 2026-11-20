/**
 * "Quantas pessoas tem o time?" tinha três respostas: o cadastro do projeto (papéis, vindo do Profields/convite),
 * as pessoas sincronizadas do Jira (squad_members) e o maior dos dois. Cada tela usava uma, então o mesmo time
 * aparecia com 3, 6 e 7 pessoas. Este é o único jeito de contar: a união das duas listas, sem repetir ninguém.
 */
export interface TeamPersonSource {
  displayName?: string;
  email?: string;
  jiraAccountId?: string;
  avatarUrl?: string;
  /** Id da conta quando a pessoa já está ligada a uma (squad_members: `claimedByUid`). */
  claimedByUid?: string;
  userId?: string;
  /** squad_members guarda o cargo em `role`; o cadastro do projeto, em `roleName`. */
  role?: string;
  roleName?: string;
}

export interface TeamPerson {
  key: string;
  displayName: string;
  email?: string;
  jiraAccountId?: string;
  avatarUrl?: string;
  role?: string;
  /** Id da conta, quando a pessoa está ligada a uma: com ele aparece a foto que ela enviou. */
  userId?: string;
}

const normName = (s?: string) =>
  (s || '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Identidade de uma pessoa: e-mail e conta do Jira. O nome só vale quando a pessoa não tem nenhum dos dois,
 * porque dois colegas com o mesmo nome (homônimos) não podem virar uma só.
 */
function identityKeys(p: TeamPersonSource): string[] {
  const keys: string[] = [];
  const email = (p.email || '').trim().toLowerCase();
  const account = (p.jiraAccountId || '').trim();
  if (email) keys.push(`e:${email}`);
  if (account) keys.push(`a:${account}`);
  if (keys.length === 0) {
    const name = normName(p.displayName);
    if (name) keys.push(`n:${name}`);
  }
  return keys;
}

/** A primeira lista manda nos dados (a do Jira traz capacidade); a segunda só acrescenta quem faltava. */
export function mergeTeamPeople(primary: TeamPersonSource[] = [], secondary: TeamPersonSource[] = []): TeamPerson[] {
  const people: TeamPerson[] = [];
  const index = new Map<string, number>();

  for (const source of [...primary, ...secondary]) {
    const keys = identityKeys(source);
    if (keys.length === 0) continue;
    const found = keys.map((k) => index.get(k)).find((i) => i !== undefined);
    if (found !== undefined) {
      const existing = people[found];
      // Completa o que faltava na primeira ocorrência (foto, cargo, e-mail) e passa a reconhecer as novas chaves.
      existing.avatarUrl = existing.avatarUrl || source.avatarUrl;
      existing.role = existing.role || source.role || source.roleName;
      existing.email = existing.email || source.email;
      existing.userId = existing.userId || source.claimedByUid || source.userId;
      existing.jiraAccountId = existing.jiraAccountId || source.jiraAccountId;
      identityKeys(existing).forEach((k) => index.set(k, found));
      continue;
    }
    const person: TeamPerson = {
      key: keys[0],
      displayName: source.displayName || source.email || '',
      email: source.email,
      jiraAccountId: source.jiraAccountId,
      avatarUrl: source.avatarUrl,
      role: source.role || source.roleName,
      userId: source.claimedByUid || source.userId,
    };
    people.push(person);
    keys.forEach((k) => index.set(k, people.length - 1));
  }
  return people;
}

/**
 * Quando os dados do Jira foram atualizados pela última vez. A última execução da sincronização e a data dos
 * itens/métricas contam igualmente: as duas telas do time liam fontes diferentes e uma dizia "ainda não
 * sincronizado" enquanto a outra dizia "sincronizado há 3 minutos".
 */
export function latestSyncAt(...candidates: Array<string | null | undefined>): string {
  let best = '';
  let bestTime = -Infinity;
  for (const c of candidates) {
    if (!c) continue;
    const t = Date.parse(c);
    if (Number.isFinite(t) && t > bestTime) {
      best = c;
      bestTime = t;
    }
  }
  return best;
}
