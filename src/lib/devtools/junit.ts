// Gerador local de esqueleto JUnit 5 + Mockito a partir de uma classe Java (regex, sem IA).
// Portado do legado sem mudar a heurística: campos "private" viram @Mock, métodos "public" viram cenários.

export interface JavaField { type: string; name: string }
export interface JavaMethod { returnType: string; name: string; params: string }

export const NO_CLASS_MESSAGE = '// Classe Java não detectada ou inválida...';

const defaultValueForType = (type: string) => {
  const t = type.trim();
  if (['int', 'long', 'double', 'float', 'short', 'byte'].includes(t)) return '0';
  if (t === 'boolean') return 'false';
  if (t === 'String') return '""';
  if (t === 'char') return "'\\u0000'";
  return 'null';
};

/** Devolve o código do teste, ou null se nenhuma classe for detectada. */
export function generateJUnitSkeleton(javaCode: string): string | null {
  const pkg = javaCode.match(/package\s+([\w.]+);/)?.[1] ?? '';
  const classMatch = javaCode.match(/(?:public|protected|private)?\s*(?:abstract|final)?\s*class\s+(\w+)/);
  if (!classMatch) return null;
  const className = classMatch[1];

  // Dependências: campos privados (viram @Mock)
  const fields: JavaField[] = [];
  const fieldRegex = /private\s+(?:final\s+)?([\w<>, ?]+)\s+(\w+)\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRegex.exec(javaCode)) !== null) fields.push({ type: m[1].trim(), name: m[2].trim() });

  // Métodos públicos (exceto construtores): 1 = retorno, 2 = nome, 3 = parâmetros
  const methods = new Map<string, JavaMethod>();
  const methodRegex = /public\s+(?:(?:<[^>]+>\s+)?)([\w<>[\]?]+)\s+(\w+)\s*\(([^)]*)\)/g;
  while ((m = methodRegex.exec(javaCode)) !== null) {
    if (m[2] !== className && !methods.has(m[2])) methods.set(m[2], { returnType: m[1], name: m[2], params: m[3] });
  }

  let out = pkg ? `package ${pkg};\n\n` : '';
  out += `import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ${className}Test {

`;
  fields.forEach(f => {
    out += `    @Mock\n    private ${f.type} ${f.name};\n\n`;
  });
  out += `    @InjectMocks\n    private ${className} target;\n\n`;

  if (methods.size === 0) {
    out += `    @Test\n    @DisplayName("Teste de inicialização do contexto")\n    void contextLoads() {\n        // Arrange\n\n        // Act\n\n        // Assert\n    }\n\n`;
  }

  methods.forEach(method => {
    const cap = method.name.charAt(0).toUpperCase() + method.name.slice(1);

    // Arrange: um valor padrão por parâmetro
    let arrange = '';
    const args = method.params
      .split(',')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => {
        const parts = p.split(/\s+/);
        const pName = parts[parts.length - 1];
        const pType = parts.slice(0, -1).join(' ');
        arrange += `        ${pType} ${pName} = ${defaultValueForType(pType)}; // TODO: Inicialize os valores corretamente\n`;
        return pName;
      })
      .join(', ');

    const firstMock = fields[0]?.name;
    const mockBehaviors = firstMock
      ? `        // TODO: Simule comportamentos dos mocks (se necessário)\n        // when(${firstMock}.algumMetodo(any())).thenReturn(resultadoEsperado);\n\n`
      : '';

    const isVoid = method.returnType === 'void';
    const act = isVoid ? `        target.${method.name}(${args});` : `        ${method.returnType} result = target.${method.name}(${args});`;
    const assertBlock = isVoid
      ? `        // TODO: Valide os side-effects (ex: interações com o repositório)\n        // verify(${firstMock ?? 'mockA'}, times(1)).algumMetodo();`
      : `        // TODO: Substitua pelo assert correspondente\n        assertNotNull(result);\n        // assertEquals(esperado, result);`;

    // Cenário 1: caminho feliz
    out += `    @Test\n    @DisplayName("Deve executar ${method.name} com sucesso")\n    void shouldExecute${cap}Successfully() {\n        // Arrange\n${arrange ? arrange + '\n' : ''}${mockBehaviors}        // Act\n${act}\n\n        // Assert\n${assertBlock}\n    }\n\n`;

    // Cenário 2: exceção
    const exMocks = firstMock
      ? `        // TODO: Force um erro em uma dependência (ex: Repositório lançar banco fora)\n        // doThrow(new RuntimeException("Database error")).when(${firstMock}).algumMetodo();\n\n`
      : '';
    const exAct = `        // Act & Assert\n        RuntimeException exception = assertThrows(RuntimeException.class, () -> {\n            target.${method.name}(${args});\n        });\n\n        // Validação da mensagem de erro e do fluxo interrompido\n        // assertEquals("Mensagem esperada", exception.getMessage());\n`;
    out += `    @Test\n    @DisplayName("Deve lançar exceção e interromper o fluxo quando ${method.name} falhar")\n    void shouldThrowExceptionWhen${cap}Fails() {\n        // Arrange\n${arrange ? arrange + '\n' : ''}${exMocks}${exAct}    }\n\n`;
  });

  return out + '}\n';
}
