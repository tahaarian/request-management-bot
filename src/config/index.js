require('dotenv').config();

const config = {
  api: {
    baseUrl: process.env.API_BASE_URL || 'https://famsapi.sandpod.ir',
    token: process.env.API_TOKEN || '',
  },
  polling: {
    intervalMs: parseInt(process.env.POLL_INTERVAL_MS || '10000', 10),
  },
  requests: {
    allowedStateIds: (process.env.ALLOWED_STATE_IDS || '1')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter(Boolean),
    listType: parseInt(process.env.REQUEST_LIST_TYPE || '1', 10),
  },
  discussion: {
    text: process.env.DISCUSSION_TEXT || 'این درخواست دریافت شد و در حال بررسی است.',
    creatorSsoId: process.env.CREATOR_SSO_ID || '',
  },
  excel: {
    filePath: process.env.ACCOUNT_MANAGER_EXCEL_PATH || './account_managers.xlsx',
    bizIdColumn: process.env.EXCEL_BIZ_ID_COLUMN || 'bizId',
    managerNameColumn: process.env.EXCEL_MANAGER_NAME_COLUMN || 'managerName',
  },
  bizFieldId: process.env.BIZ_FIELD_ID ? parseInt(process.env.BIZ_FIELD_ID, 10) : null,
  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT || '3001', 10),
  },
  db: {
    path: process.env.DB_PATH || './data/fams.db',
  },
};

module.exports = config;
