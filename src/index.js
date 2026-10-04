require('dotenv').config();
const config = require('./config');
const logger = require('./utils/logger');
const { getDb } = require('./db');
const { pollAndProcess } = require('./processors/requestProcessor');
const { startDashboard } = require('./dashboard/server');

async function main() {
  logger.info('FAMS Request Bot starting...');

  if (!config.api.token) {
    logger.warn('API_TOKEN is not set. Requests will likely fail with INVALID_TOKEN.');
  }

  // Init DB
  await getDb();
  logger.info('Database initialized');

  // Start dashboard
  startDashboard();

  // First poll immediately
  await pollAndProcess();

  // Then poll on interval
  setInterval(async () => {
    await pollAndProcess();
  }, config.polling.intervalMs);

  logger.info(`Polling every ${config.polling.intervalMs / 1000}s`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
