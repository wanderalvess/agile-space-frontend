const fs = require('fs');
const path = require('path');

function moveDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      moveDir(srcPath, destPath);
    } else {
      fs.renameSync(srcPath, destPath);
    }
  }
  fs.rmdirSync(src);
}

// 1. Move components
moveDir('./src/components/dashboards', './src/components/governance');

// 2. Move app routes
moveDir('./src/app/dashboards', './src/app/governance');

// 3. Fix imports in product-owner/page.tsx
const poPage = './src/app/governance/product-owner/page.tsx';
let content = fs.readFileSync(poPage, 'utf-8');
content = content.replace(/@\/components\/dashboards/g, '@/components/governance');
content = content.replace(/\/dashboards\//g, '/governance/');
fs.writeFileSync(poPage, content);

// 4. Fix imports in components
const components = fs.readdirSync('./src/components/governance');
for (let comp of components) {
  if (comp.endsWith('.tsx')) {
    const p = path.join('./src/components/governance', comp);
    let c = fs.readFileSync(p, 'utf-8');
    c = c.replace(/@\/components\/dashboards/g, '@/components/governance');
    fs.writeFileSync(p, c);
  }
}
