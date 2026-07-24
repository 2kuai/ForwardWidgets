const fs = require('node:fs');
const path = require('node:path');
const { validateData } = require('./lib/data-contract.cjs');

const filePath = process.argv[2];
if (!filePath) {
  throw new Error('Usage: node scripts/validate-generated-data.js <data-file>');
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const recordCount = validateData(data);
console.log(`[data] ${path.basename(filePath)}: ${recordCount} media records match the shared contract.`);
