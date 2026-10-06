// Inferência de tipos a partir de JSON (portado do legado). Funções puras.
/* eslint-disable @typescript-eslint/no-explicit-any */
// LÓGICA CORE: INFERÊNCIA DE TIPOS
export function generateTypeScriptInterfaces(jsonString: string, rootName = 'Root'): string {
  const parsed = JSON.parse(jsonString);
  const interfaces: Map<string, string> = new Map();

  function capitalize(str: string) {
    if (!str) return 'Unknown';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function singularize(str: string) {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('s') && !str.endsWith('ss') && !str.endsWith('us') && !str.endsWith('is')) return str.slice(0, -1);
    return str;
  }

  function formatKeyName(key: string) {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) return key;
    return `"${key}"`;
  }

  function getType(value: any, keyName: string): string {
    if (value === null) return 'any';
    
    if (Array.isArray(value)) {
      if (value.length === 0) return 'any[]';
      const itemName = singularize(keyName);
      const itemType = getType(value[0], itemName);
      return `${itemType}[]`;
    }
    
    if (typeof value === 'object') {
      const interfaceName = capitalize(keyName);
      
      // Check interface deduplication briefly (ignoring exact structural match for simplicity, assuming unique keys name structures)
      let uniqueName = interfaceName;
      while(interfaces.has(uniqueName)) {
         // Deep equality check bypass: in a simple engine, we just add suffix if name collision but different structure is a risk.
         // For now, let's just assume we overwrite it or it's the same type.
         break;
      }
      
      const fields: string[] = [];
      for (const [k, v] of Object.entries(value)) {
        fields.push(`  ${formatKeyName(k)}: ${getType(v, k)};`);
      }
      const interfaceContent = `export interface ${uniqueName} {\n${fields.join('\n')}\n}`;
      interfaces.set(uniqueName, interfaceContent);
      return uniqueName;
    }
    
    return typeof value;
  }

  if (Array.isArray(parsed)) {
    getType(parsed[0] || {}, rootName);
  } else if (typeof parsed === 'object' && parsed !== null) {
    getType(parsed, rootName);
  } else {
    return `export type ${rootName} = ${typeof parsed};`;
  }

  // Reverse to show the Root on bottom and dependencies on top, which is conventional.
  return Array.from(interfaces.values()).reverse().join('\n\n');
}

// LÓGICA CORE: INFERÊNCIA DE TIPOS - JAVA
export function generateJavaClasses(jsonString: string, rootName = 'Root'): string {
  const parsed = JSON.parse(jsonString);
  const classes: Map<string, string> = new Map();

  function capitalize(str: string) {
    if (!str) return 'Unknown';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function singularize(str: string) {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('s') && !str.endsWith('ss') && !str.endsWith('us') && !str.endsWith('is')) return str.slice(0, -1);
    return str;
  }

  function getType(value: any, keyName: string): string {
    if (value === null) return 'Object';
    
    if (Array.isArray(value)) {
      if (value.length === 0) return 'List<Object>';
      const itemName = singularize(keyName);
      const itemType = getType(value[0], itemName);
      return `List<${itemType}>`;
    }
    
    if (typeof value === 'object') {
      const className = capitalize(keyName);
      let uniqueName = className;
      
      const fields: string[] = [];
      for (const [k, v] of Object.entries(value)) {
        fields.push(`    private ${getType(v, k)} ${k};`);
      }
      const classContent = `public class ${uniqueName} {\n${fields.join('\n')}\n\n    // Getters and Setters...\n}`;
      if (!classes.has(uniqueName)) {
        classes.set(uniqueName, classContent);
      }
      return uniqueName;
    }
    
    if (typeof value === 'string') return 'String';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'Integer' : 'Double';
    }
    if (typeof value === 'boolean') return 'Boolean';
    
    return 'Object';
  }

  if (Array.isArray(parsed)) {
    getType(parsed[0] || {}, rootName);
  } else if (typeof parsed === 'object' && parsed !== null) {
    getType(parsed, rootName);
  } else {
    return `// Tipo primitivo retornado: ${typeof parsed}`;
  }

  return 'import java.util.List;\n\n' + Array.from(classes.values()).reverse().join('\n\n');
}

// LÓGICA CORE: INFERÊNCIA DE TIPOS - DELPHI
export function generateDelphiClasses(jsonString: string, rootName = 'Root'): string {
  const parsed = JSON.parse(jsonString);
  const classes: Map<string, string> = new Map();
  // Em Delphi é comum prefixar com T

  function capitalize(str: string) {
    if (!str) return 'Unknown';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function singularize(str: string) {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('s') && !str.endsWith('ss') && !str.endsWith('us') && !str.endsWith('is')) return str.slice(0, -1);
    return str;
  }

  function getType(value: any, keyName: string): string {
    if (value === null) return 'Variant';
    
    if (Array.isArray(value)) {
      if (value.length === 0) return 'TArray<Variant>';
      const itemName = singularize(keyName);
      const itemType = getType(value[0], itemName);
      return `TArray<${itemType}>`;
    }
    
    if (typeof value === 'object') {
      const className = 'T' + capitalize(keyName);
      let uniqueName = className;
      
      const fields: string[] = [];
      const properties: string[] = [];
      
      for (const [k, v] of Object.entries(value)) {
        const propType = getType(v, k);
        fields.push(`    [JSONName('${k}')]\n    F${capitalize(k)}: ${propType};`);
        properties.push(`    property ${capitalize(k)}: ${propType} read F${capitalize(k)} write F${capitalize(k)};`);
      }

      const classContent = `  ${uniqueName} = class\n  private\n${fields.join('\n')}\n  public\n${properties.join('\n')}\n  end;`;
      
      if (!classes.has(uniqueName)) {
        classes.set(uniqueName, classContent);
      }
      return uniqueName;
    }
    
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'Integer' : 'Double';
    }
    if (typeof value === 'boolean') return 'Boolean';
    
    return 'Variant';
  }

  if (Array.isArray(parsed)) {
    getType(parsed[0] || {}, rootName);
  } else if (typeof parsed === 'object' && parsed !== null) {
    getType(parsed, rootName);
  } else {
    return `// Tipo bruto: ${typeof parsed}`;
  }

  return `unit TypesGenerated;\n\ninterface\n\nuses\n  System.Generics.Collections, REST.Json.Types;\n\ntype\n` + Array.from(classes.values()).reverse().join('\n\n') + `\n\nimplementation\n\nend.`;
}
