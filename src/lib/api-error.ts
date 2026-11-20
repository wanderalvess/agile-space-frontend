/**
 * Erro de chamada ao servidor que guarda o status HTTP. A mensagem continua sendo a do servidor;
 * o status deixa a tela escolher o caminho certo (ex.: 403 no "entrar na squad" leva ao convite).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Status HTTP de um erro vindo de `ApiError`; undefined para qualquer outro erro (rede, código). */
export function httpStatusOf(err: unknown): number | undefined {
  return err instanceof ApiError ? err.status : undefined;
}
