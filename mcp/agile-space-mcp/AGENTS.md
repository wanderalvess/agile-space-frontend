# Regras pra quem (humano ou agente) mexer neste diretório

Erros já cometidos aqui uma vez — não repetir:

1. **Nunca commitar arquivo de log/debug.** `mcp_debug.log` (ou qualquer `*.log`) é
   saída de execução local, não pertence ao git. Já está em `.gitignore` — não
   remova essa linha, e não crie outro arquivo de log fora do padrão `*.log`.

2. **Nunca escrever API key (nem truncada/parcial) em log, arquivo, ou saída de
   console.** Um prefixo de 8 caracteres ainda é segredo real. Se precisar
   confirmar que uma env var está setada, logue `"definida"`/`"ausente"`, nunca
   um pedaço do valor.

3. **Nunca setar `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` incondicionalmente.**
   Isso desliga validação de certificado TLS pro processo Node inteiro (toda
   chamada HTTPS, não só a que tem problema de proxy corporativo) — abre risco
   de MITM bem na chamada que carrega a API key. Se for mesmo necessário (rede
   corporativa com certificado self-signed), deixe opt-in via env var explícita
   (ver `MCP_ALLOW_INSECURE_TLS` em `client.ts`) — nunca ligado por padrão.

4. **Nunca hardcodar caminho absoluto de arquivo com nome de usuário/máquina**
   (tipo `C:/Users/<alguem>/...`). Esse código roda em máquinas diferentes das
   de quem escreveu. Use caminho relativo ao módulo (`path.dirname(fileURLToPath(import.meta.url))`)
   ou relativo ao cwd, nunca um caminho absoluto fixo.

Se alguma dessas regras parecer estar sendo quebrada num diff, pare e avise —
não assuma que "já passou uma vez, deve estar ok".
