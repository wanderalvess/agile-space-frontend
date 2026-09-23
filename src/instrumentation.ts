// Instrumentação OpenTelemetry do servidor Next.js (App Router chama register() uma vez no boot).
// Vendor-neutro (OTLP) — funciona com SigNoz ou qualquer outro backend compatível, só trocando
// OTEL_EXPORTER_OTLP_ENDPOINT. Sem essa env var, fica inerte (não tenta exportar pra lugar nenhum).
export async function register() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return;
  }

  const { registerOTel } = await import('@vercel/otel');
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'agile-space-frontend',
  });
}
