// generate-biz-managers.js
// Dependencies: npm install xlsx
// Usage: node generate-biz-managers.js

const XLSX = require('xlsx');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'MainAndBranchBusInfo.xlsx');
const OUTPUT_FILE = path.join(__dirname, 'account_managers.xlsx');

function normalizeId(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  if (isNaN(n)) return null;
  return String(Math.round(n)); // handles float IDs like 3167099.0
}

function main() {
  const wb = XLSX.readFile(INPUT_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  // Map of bizId -> managerName (first-seen wins on duplicates)
  const bizMap = new Map();

  for (const row of rows) {
    const manager = (row['accountManager'] || '').toString().trim();

    const mainId = normalizeId(row['mainBusId']);
    if (mainId && !bizMap.has(mainId)) {
      bizMap.set(mainId, manager);
    }

    const branchId = normalizeId(row['branchBusId']);
    if (branchId && !bizMap.has(branchId)) {
      bizMap.set(branchId, manager);
    }
  }

  // Build output rows
  const output = Array.from(bizMap.entries()).map(([bizId, managerName]) => ({
    bizId,
    managerName,
  }));

  // Write output Excel
  const outWb = XLSX.utils.book_new();
  const outWs = XLSX.utils.json_to_sheet(output, { header: ['bizId', 'managerName'] });

  // Set column widths for readability
  outWs['!cols'] = [{ wch: 15 }, { wch: 30 }];

  XLSX.utils.book_append_sheet(outWb, outWs, 'BizManagers');
  XLSX.writeFile(outWb, OUTPUT_FILE);

  console.log(`✓ Done: ${output.length} distinct bizIds → ${OUTPUT_FILE}`);
}

main();
