const fs = require('fs');
const path = require('path');

// Helper to print usage instructions
function printUsage() {
  console.log('\x1b[36m%s\x1b[0m', 'Uso do Version & Changelog Bumper:');
  console.log('  npm run bump <type> "<title>" "<description>" "<changes_semicolon_separated>"');
  console.log('\nParâmetros:');
  console.log('  type:                     patch | minor | major');
  console.log('  title:                    Título descritivo da versão (ex: "Smart Jira Integration")');
  console.log('  description:              Resumo rápido das mudanças');
  console.log('  changes:                  Lista de alterações separadas por ponto e vírgula (;)');
  console.log('\nExemplo:');
  console.log('  npm run bump patch "UI Polishing" "Ajustes no layout" "Corrigido cor de fundo; Otimizado espaçamento do header"');
}

// Check arguments
const args = process.argv.slice(2);
if (args.length < 4) {
  printUsage();
  process.exit(1);
}

const [bumpType, title, description, rawChanges] = args;

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('\x1b[31mErro: O tipo de bump deve ser "patch", "minor" ou "major".\x1b[0m');
  process.exit(1);
}

// 1. Read and update package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

const parts = currentVersion.split('.').map(Number);
if (bumpType === 'major') {
  parts[0]++;
  parts[1] = 0;
  parts[2] = 0;
} else if (bumpType === 'minor') {
  parts[1]++;
  parts[2] = 0;
} else if (bumpType === 'patch') {
  parts[2]++;
}
const newVersion = parts.join('.');

// 2. Format the current date in Portuguese
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const now = new Date();
const dateStr = `${now.getDate()} de ${months[now.getMonth()]}, ${now.getFullYear()}`;

// 3. Determine icon based on release type
let icon = { name: "Sparkles", className: "h-5 w-5 text-emerald-500" };
if (bumpType === 'major') {
  icon = { name: "Rocket", className: "h-5 w-5 text-primary" };
} else if (bumpType === 'patch') {
  icon = { name: "Zap", className: "h-5 w-5 text-indigo-500" };
}

// 4. Parse changes
const changes = rawChanges
  .split(';')
  .map(c => c.trim())
  .filter(c => c.length > 0);

// 5. Build new changelog entry
const newEntry = {
  tag: `v${newVersion}`,
  date: dateStr,
  title,
  description,
  changes,
  type: bumpType,
  icon
};

// 6. Update versions.json
const versionsJsonPath = path.join(__dirname, '../src/app/changelog/versions.json');
let versionsList = [];
try {
  versionsList = JSON.parse(fs.readFileSync(versionsJsonPath, 'utf8'));
} catch (e) {
  console.warn('versions.json não encontrado ou inválido. Criando um novo.');
}

versionsList.unshift(newEntry);

// Write changes back to files
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
fs.writeFileSync(versionsJsonPath, JSON.stringify(versionsList, null, 2) + '\n', 'utf8');

console.log('\n\x1b[32m%s\x1b[0m', `Sucesso! Versão atualizada de v${currentVersion} para v${newVersion}`);
console.log(`- package.json atualizado para a versão: ${newVersion}`);
console.log(`- Novo registro adicionado ao changelog em: ${versionsJsonPath}`);
console.log(`  Métricas do Registro: ${changes.length} alterações listadas.`);
