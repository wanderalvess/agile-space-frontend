// Instrumentação OpenTelemetry do servidor Next.js (App Router chama register() uma vez no boot).
// Vendor-neutro (OTLP) — funciona com SigNoz ou qualquer outro backend compatível, só trocando
// OTEL_EXPORTER_OTLP_ENDPOINT. Sem essa env var, fica inerte (não tenta exportar pra lugar nenhum).
export async function register() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return;
  }

  try {
    const pkg = '@vercel/otel';
    const { registerOTel } = await import(/* webpackIgnore: true */ pkg);
    registerOTel({
      serviceName: process.env.OTEL_SERVICE_NAME || 'agile-space-frontend',
    });
  } catch (error) {
    console.warn('[instrumentation] OpenTelemetry não pôde ser inicializado:', error);
  }
}
