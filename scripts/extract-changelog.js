const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/changelog/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Find the versions array
const startIdx = content.indexOf('const versions = [');
if (startIdx === -1) {
  console.error('Could not find versions array');
  process.exit(1);
}

// Find the closing bracket of the array
let bracketCount = 1;
let endIdx = -1;
for (let i = startIdx + 'const versions = ['.length; i < content.length; i++) {
  if (content[i] === '[') bracketCount++;
  if (content[i] === ']') bracketCount--;
  if (bracketCount === 0) {
    endIdx = i + 1;
    break;
  }
}

if (endIdx === -1) {
  console.error('Could not find end of versions array');
  process.exit(1);
}

const arrayText = content.substring(startIdx + 'const versions ='.length, endIdx);

// We will parse the JS object/array text into a clean JS array using eval (safe here as we wrote the source file)
let versions;
try {
  // Replace JSX elements with a custom string representation so they can be parsed
  const cleanedText = arrayText
    .replace(/icon:\s*<(\w+)\s+className="([^"]+)"\s*\/>/g, 'icon: { name: "$1", className: "$2" }');
  
  versions = eval(cleanedText);
} catch (e) {
  console.error('Error parsing array text:', e);
  process.exit(1);
}

// Write the JSON to file
const jsonPath = path.join(__dirname, '../src/app/changelog/versions.json');
fs.writeFileSync(jsonPath, JSON.stringify(versions, null, 2), 'utf8');
console.log('Successfully extracted', versions.length, 'versions to', jsonPath);
