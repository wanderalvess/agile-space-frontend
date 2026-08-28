import { NextRequest, NextResponse } from 'next/server';

interface CustomMock {
  id: string;
  method: string;
  url: string;
  cleanPath?: string;
  queryParams?: Record<string, string>;
  payload: string;
  status?: number;
  delay?: number;
  createdAt: string;
}

interface SwaggerDoc {
  id: string;
  title: string;
  spec: any;
  createdAt: string;
}

function parseUrlPathAndQuery(reqUrl: string): {
  cleanPath: string;
  queryParams: Record<string, string>;
} {
  const urlObj = new URL(reqUrl, 'http://localhost');
  let pathname = urlObj.pathname.replace(/^\/api\/mock\/?/i, '');
  pathname = pathname.trim().replace(/^\/+|\/+$/g, '').toLowerCase();

  const queryParams: Record<string, string> = {};
  urlObj.searchParams.forEach((val, key) => {
    queryParams[key.toLowerCase()] = val.toLowerCase();
  });

  return { cleanPath: pathname, queryParams };
}

function generateMockFromSwaggerSchema(schema: any): any {
  if (!schema) return { message: 'Response generated from Swagger contract' };

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  if (schema.type === 'object' || schema.properties) {
    const obj: Record<string, any> = {};
    const props = schema.properties || {};
    for (const key of Object.keys(props)) {
      obj[key] = generateMockFromSwaggerSchema(props[key]);
    }
    return obj;
  }

  if (schema.type === 'array' || schema.items) {
    return [generateMockFromSwaggerSchema(schema.items || {})];
  }

  if (schema.type === 'string') {
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'date') return new Date().toISOString().split('T')[0];
    if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
    if (schema.enum && schema.enum.length > 0) return schema.enum[0];
    return 'exemplo_texto';
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    return schema.enum ? schema.enum[0] : 100;
  }

  if (schema.type === 'boolean') {
    return true;
  }

  return { message: 'Swagger Mock Dynamic Payload' };
}

async function handleMockRequest(
  req: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const slug = resolvedParams?.slug || [];

    const method = req.method.toUpperCase();
    const { cleanPath, queryParams: reqQueryParams } = parseUrlPathAndQuery(req.url);

    // Fallback cleanPath from slug if URL parsing is empty
    const targetCleanPath = cleanPath || slug.join('/').toLowerCase();

    const customMocks: CustomMock[] = (global as any).customMocks || [];

    // -------------------------------------------------------------
    // CAMADA 1: Custom Override (Mocks Manuais em Memória)
    // -------------------------------------------------------------
    const candidateMocks = customMocks.filter((m) => {
      const matchMethod = m.method.toUpperCase() === method;

      let storedCleanPath = m.cleanPath;
      if (!storedCleanPath) {
        let clean = m.url.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, '');
        clean = clean.replace(/^https?:\/\/[^/]+/i, '');
        clean = clean.replace(/^https?:\/\/\{\{[^}]+\}\}(?::\{\{[^}]+\}\})?/i, '');
        clean = clean.replace(/^\{\{[^}]+\}\}(?::\{\{[^}]+\}\})?/i, '');
        storedCleanPath = clean.split('?')[0].trim().replace(/^\/+|\/+$/g, '').toLowerCase();
      }

      return matchMethod && storedCleanPath === targetCleanPath;
    });

    if (candidateMocks.length > 0) {
      let bestMatch = candidateMocks.find((m) => {
        if (!m.queryParams || Object.keys(m.queryParams).length === 0) return false;
        return Object.entries(m.queryParams).every(
          ([k, v]) => reqQueryParams[k] === v
        );
      });

      if (!bestMatch) {
        bestMatch = candidateMocks[0];
      }

      let parsedPayload: any;
      try {
        parsedPayload = JSON.parse(bestMatch.payload);
      } catch {
        parsedPayload = bestMatch.payload;
      }

      if (bestMatch.delay && bestMatch.delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, bestMatch.delay));
      }

      return NextResponse.json(parsedPayload, {
        status: bestMatch.status || 200,
        headers: {
          'x-mock-engine': 'agile-space-manual-override',
          'x-matched-path': targetCleanPath,
          'x-mock-delay-ms': String(bestMatch.delay || 0),
        },
      });
    }

    // -------------------------------------------------------------
    // CAMADA 2: Swagger Fallback
    // -------------------------------------------------------------
    const swaggerDocs: SwaggerDoc[] = (global as any).swaggerDocs || [];
    const lowerMethod = method.toLowerCase();

    for (const doc of swaggerDocs) {
      const spec = doc.spec;
      if (!spec || !spec.paths) continue;

      for (const [pathKey, pathObj] of Object.entries(spec.paths)) {
        let normalizedPathKey = pathKey.split('?')[0].trim().replace(/^\/+|\/+$/g, '').toLowerCase();

        const isExactMatch = normalizedPathKey === targetCleanPath;
        const isRegexMatch = new RegExp(
          `^${normalizedPathKey.replace(/\{[^}]+\}/g, '[^/]+')}$`
        ).test(targetCleanPath);

        if ((isExactMatch || isRegexMatch) && (pathObj as any)[lowerMethod]) {
          const operation = (pathObj as any)[lowerMethod];
          const responses = operation.responses || {};
          const successResponse =
            responses['200'] || responses['201'] || responses['default'];

          let mockPayload: any = null;

          if (successResponse) {
            if (successResponse.content) {
              const jsonContent =
                successResponse.content['application/json'] ||
                Object.values(successResponse.content)[0];
              if (jsonContent) {
                if (jsonContent.example) {
                  mockPayload = jsonContent.example;
                } else if (jsonContent.schema) {
                  mockPayload = generateMockFromSwaggerSchema(
                    jsonContent.schema
                  );
                }
              }
            } else if (successResponse.schema) {
              mockPayload = generateMockFromSwaggerSchema(
                successResponse.schema
              );
            } else if (successResponse.examples) {
              mockPayload =
                successResponse.examples['application/json'] ||
                Object.values(successResponse.examples)[0];
            }
          }

          if (!mockPayload) {
            mockPayload = {
              message: `Mock automático gerado a partir do Swagger (${doc.title})`,
              path: targetCleanPath,
              method,
            };
          }

          return NextResponse.json(mockPayload, {
            status: 200,
            headers: {
              'x-mock-engine': 'agile-space-swagger-fallback',
              'x-swagger-doc': doc.title,
            },
          });
        }
      }
    }

    // -------------------------------------------------------------
    // CAMADA 404: Diagnóstico detalhado de rota não encontrada
    // -------------------------------------------------------------
    const registeredCustomMocks = customMocks.map(
      (m) => `${m.method.toUpperCase()} ${m.cleanPath || m.url}`
    );

    return NextResponse.json(
      {
        error: 'Rota não encontrada no Motor de Mock do Espaço Ágil',
        detalhes: {
          metodoSolicitado: method,
          rotaSolicitada: targetCleanPath,
          mocksCadastradosEmMemoria: registeredCustomMocks,
        },
      },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro interno no Motor de Mock' },
      { status: 500 }
    );
  }
}

export const GET = handleMockRequest;
export const POST = handleMockRequest;
export const PUT = handleMockRequest;
export const DELETE = handleMockRequest;
export const PATCH = handleMockRequest;
export const HEAD = handleMockRequest;
export const OPTIONS = handleMockRequest;
