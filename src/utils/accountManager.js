const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const config = require('../config');
const logger = require('./logger');

let mappingCache = null;

function loadMapping() {
  const filePath = path.resolve(config.excel.filePath);
  if (!fs.existsSync(filePath)) {
    logger.warn(`Account manager Excel file not found at: ${filePath}`);
    return {};
  }

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const mapping = {};
    for (const row of rows) {
      const bizId = String(row[config.excel.bizIdColumn] || '').trim();
      const managerName = String(row[config.excel.managerNameColumn] || '').trim();
      if (bizId && managerName) {
        mapping[bizId] = managerName;
      }
    }
    logger.info(`Loaded ${Object.keys(mapping).length} account manager mappings from Excel`);
    return mapping;
  } catch (err) {
    logger.error('Failed to load account manager Excel:', err.message);
    return {};
  }
}

function getMapping() {
  if (!mappingCache) {
    mappingCache = loadMapping();
  }
  return mappingCache;
}

function reloadMapping() {
  mappingCache = loadMapping();
}

function getAccountManager(bizId) {
  if (!bizId) return null;
  const mapping = getMapping();
  return mapping[String(bizId).trim()] || null;
}

module.exports = { getAccountManager, reloadMapping };
