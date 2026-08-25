const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Iniciando recuperação do histórico do Git...');

try {
  // 1. Puxa os commits desde 24 de Junho de 2025
  // Formato: Hash|Data(YYYY-MM-DD)|Mensagem
  const gitLogCommand = 'git log --since="2025-06-24" --format="%H|%ad|%s" --date=short';
  const stdout = execSync(gitLogCommand, { encoding: 'utf-8' });
  
  const commits = stdout.split('\n').filter(line => line.trim().length > 0);
  
  if (commits.length === 0) {
    console.log('Nenhum commit encontrado desde 24/06/2026.');
    process.exit(0);
  }

  console.log(`Foram encontrados ${commits.length} commits. Processando...`);

  // Lemos o package.json atual
  const packageJsonPath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version; // ex: 3.28.0
  let [major, minor, patch] = currentVersion.split('.').map(Number);

  // Lemos o versions.json
  const versionsJsonPath = path.join(__dirname, '../src/app/changelog/versions.json');
  let versionsList = [];
  try {
    versionsList = JSON.parse(fs.readFileSync(versionsJsonPath, 'utf8'));
  } catch (e) {
    console.warn('versions.json não encontrado. Criando um novo.');
  }

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const newEntries = [];

  // Revertemos para iterar do mais ANTIGO para o mais NOVO
  const commitsAntigoParaNovo = commits.reverse();

  commitsAntigoParaNovo.forEach(commitLine => {
    const [hash, dateStr, ...msgParts] = commitLine.split('|');
    let message = msgParts.join('|').trim();
    
    // Ignorar merges
    if (message.startsWith('Merge branch') || message.startsWith('Merge pull request')) {
      return; 
    }

    let bumpType = "patch";
    let iconName = "Zap";
    let iconClass = "text-indigo-500";
    
    const lowerMessage = message.toLowerCase();
    
    // Heurística para Major
    if (lowerMessage.includes('breaking') || lowerMessage.includes('reestruturação total') || lowerMessage.includes('refatoração profunda') || lowerMessage.includes('major')) {
      bumpType = "major";
      iconName = "Rocket";
      iconClass = "text-primary";
      major++;
      minor = 0;
      patch = 0;
    } 
    // Heurística para Minor (Features / Refactor / Melhorias)
    else if (lowerMessage.match(/\b(feat|feature|melhoria|refactor)\b/) || lowerMessage.match(/^(add|adicionado|nova|novo|cria|criado|implementa|implementado|suporte|integração)/)) {
      bumpType = "minor";
      iconName = "Sparkles";
      iconClass = "text-emerald-500";
      minor++;
      patch = 0;
    } 
    // Default é Patch (fix, chore, corrige, etc)
    else {
      patch++;
    }

    const newVersion = `${major}.${minor}.${patch}`;

    const dateObj = new Date(dateStr + 'T12:00:00');
    const formattedDate = `${dateObj.getDate()} de ${months[dateObj.getMonth()]}, ${dateObj.getFullYear()}`;

    let title = "Atualização do Sistema";
    let desc = message;
    
    if (message.length > 55) {
      title = message.substring(0, 55) + "...";
    } else {
      title = message;
      desc = "Atualização baseada no commit: " + hash.substring(0, 7);
    }

    const newEntry = {
      tag: `v${newVersion}`,
      date: formattedDate,
      title: title,
      description: desc,
      changes: [ message ],
      type: bumpType,
      icon: {
        name: iconName,
        className: `h-5 w-5 ${iconClass}`
      }
    };

    newEntries.push(newEntry);
  });

  // Reverte para colocar o mais novo no topo
  const entradasParaInserir = newEntries.reverse();

  versionsList = [...entradasParaInserir, ...versionsList];

  // Atualiza arquivos
  packageJson.version = `${major}.${minor}.${patch}`;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  fs.writeFileSync(versionsJsonPath, JSON.stringify(versionsList, null, 2) + '\n', 'utf8');

  console.log('\n\x1b[32m%s\x1b[0m', `Sucesso! O histórico foi recuperado.`);
  console.log(`- Foram adicionadas ${entradasParaInserir.length} novas versões no changelog.`);
  console.log(`- package.json atualizado para a versão mais recente: ${packageJson.version}`);

} catch (error) {
  console.error('\x1b[31mErro ao executar o script:\x1b[0m', error.message);
}
