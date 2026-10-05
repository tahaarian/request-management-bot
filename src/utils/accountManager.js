// src/accountManager.js
const xlsx = require('xlsx');
const path = require('path');

let managerMap = null;

function loadManagers() {
  if (managerMap) return managerMap;

  const filePath = path.resolve(process.cwd(), 'account_managers.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  managerMap = new Map();
  for (const row of rows) {
    const bizId = String(row.bizId ?? row.BizId ?? row.biz_id ?? '').trim();
    const name  = String(row.managerName ?? row.ManagerName ?? row.manager_name ?? '').trim();
    if (bizId) managerMap.set(bizId, name || '—');
  }

  return managerMap;
}

function getManagerName(bizId) {
  const map = loadManagers();
  return map.get(String(bizId)) ?? null;
}

// alias برای سازگاری با requestProcessor
const getAccountManager = getManagerName;

module.exports = { getManagerName, getAccountManager, loadManagers };
