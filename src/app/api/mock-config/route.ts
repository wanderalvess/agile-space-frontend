import { NextRequest, NextResponse } from 'next/server';

export interface CustomMock {
  id: string;
  method: string;
  url: string; // Full or relative URL
  cleanPath: string; // Base path without query string or host
  queryParams?: Record<string, string>; // Parsed query parameters if any
  payload: string;
  status?: number;
  delay?: number;
  createdAt: string;
}

export interface SwaggerDoc {
  id: string;
  title: string;
  spec: any;
  createdAt: string;
}

// Global declaration for Node environment
declare global {
  // eslint-disable-next-line no-var
  var customMocks: CustomMock[] | undefined;
  // eslint-disable-next-line no-var
  var swaggerDocs: SwaggerDoc[] | undefined;
}

function getMocks(): CustomMock[] {
  if (!global.customMocks) {
    global.customMocks = [];
  }
  return global.customMocks;
}

function getSwaggerDocs(): SwaggerDoc[] {
  if (!global.swaggerDocs) {
    global.swaggerDocs = [];
  }
  return global.swaggerDocs;
}

/**
 * Sanitizes URLs containing host, port, variables like {{host}}, query strings, etc.
 * Example: "GET http://{{host}}:{{port}}/winthor/integracao/fulfillment/v1/layout/resolverUrlsRotasWta?integracao=pdvsync&tipoLote=true"
 * Output: { cleanPath: "winthor/integracao/fulfillment/v1/layout/resolverurlsrotaswta", queryParams: { integracao: "pdvsync", tipoLote: "true" }, rawUrl: ... }
 */
export function parseRouteUrl(inputUrl: string): {
  cleanPath: string;
  queryParams: Record<string, string>;
  rawUrl: string;
} {
  let urlStr = inputUrl.trim();

  // Strip method prefix if user pasted "GET http://..."
  urlStr = urlStr.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, '');

  // Strip protocol and host/port or template variables like {{host}}:{{port}}
  urlStr = urlStr.replace(/^https?:\/\/[^/]+/i, '');
  urlStr = urlStr.replace(/^https?:\/\/\{\{[^}]+\}\}(?::\{\{[^}]+\}\})?/i, '');
  urlStr = urlStr.replace(/^\{\{[^}]+\}\}(?::\{\{[^}]+\}\})?/i, '');

  // Split query string
  const [pathPart, queryPart] = urlStr.split('?');

  const cleanPath = pathPart.trim().replace(/^\/+|\/+$/g, '').toLowerCase();

  const queryParams: Record<string, string> = {};
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    searchParams.forEach((val, key) => {
      queryParams[key.toLowerCase()] = val.toLowerCase();
    });
  }

  return { cleanPath, queryParams, rawUrl: inputUrl };
}

export async function GET() {
  return NextResponse.json({
    customMocks: getMocks(),
    swaggerDocs: getSwaggerDocs(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, mock, swagger } = body;

    if (type === 'swagger') {
      if (!swagger || !swagger.spec) {
        return NextResponse.json(
          { error: 'Especificação Swagger inválida.' },
          { status: 400 }
        );
      }

      const docs = getSwaggerDocs();
      let parsedSpec = swagger.spec;
      if (typeof parsedSpec === 'string') {
        parsedSpec = JSON.parse(parsedSpec);
      }

      const newDoc: SwaggerDoc = {
        id: swagger.id || `swagger-${Date.now()}`,
        title: parsedSpec.info?.title || swagger.title || 'Swagger Contract',
        spec: parsedSpec,
        createdAt: new Date().toISOString(),
      };

      const existingIdx = docs.findIndex((d) => d.id === newDoc.id);
      if (existingIdx >= 0) {
        docs[existingIdx] = newDoc;
      } else {
        docs.push(newDoc);
      }

      return NextResponse.json({
        success: true,
        message: 'Contrato Swagger salvo com sucesso!',
        doc: newDoc,
        swaggerDocs: docs,
      });
    }

    // Default: Manual Custom Mock
    if (!mock || !mock.method || !mock.url) {
      return NextResponse.json(
        { error: 'Parâmetros método e URL são obrigatórios para Mock Manual.' },
        { status: 400 }
      );
    }

    // Validate payload JSON
    let rawPayload = mock.payload || '{}';
    if (typeof rawPayload === 'object') {
      rawPayload = JSON.stringify(rawPayload, null, 2);
    } else {
      try {
        JSON.parse(rawPayload);
      } catch {
        return NextResponse.json(
          { error: 'Payload de resposta não é um JSON válido.' },
          { status: 400 }
        );
      }
    }

    const mocks = getMocks();
    const { cleanPath, queryParams } = parseRouteUrl(mock.url);

    const newMock: CustomMock = {
      id: mock.id || `mock-${Date.now()}`,
      method: mock.method.toUpperCase(),
      url: mock.url.trim(),
      cleanPath,
      queryParams,
      payload: rawPayload,
      status: mock.status || 200,
      delay: mock.delay || 0,
      createdAt: new Date().toISOString(),
    };

    // Replace existing mock with same method, cleanPath, and queryParams signature
    const existingIndex = mocks.findIndex((m) => {
      const sameMethod = m.method === newMock.method;
      const samePath = (m.cleanPath || parseRouteUrl(m.url).cleanPath) === cleanPath;
      return sameMethod && samePath;
    });

    if (existingIndex >= 0) {
      mocks[existingIndex] = newMock;
    } else {
      mocks.push(newMock);
    }

    return NextResponse.json({
      success: true,
      message: 'Mock Manual salvo com sucesso no motor local!',
      mock: newMock,
      customMocks: mocks,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar configuração do Mock.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'manual';

    if (type === 'swagger') {
      const docs = getSwaggerDocs();
      if (id) {
        global.swaggerDocs = docs.filter((d) => d.id !== id);
      } else {
        global.swaggerDocs = [];
      }
      return NextResponse.json({
        success: true,
        message: 'Contrato Swagger removido.',
        swaggerDocs: global.swaggerDocs,
      });
    }

    const mocks = getMocks();
    if (id) {
      global.customMocks = mocks.filter((m) => m.id !== id);
    } else {
      global.customMocks = [];
    }

    return NextResponse.json({
      success: true,
      message: 'Mock Manual removido.',
      customMocks: global.customMocks,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao remover mock.' },
      { status: 500 }
    );
  }
}
