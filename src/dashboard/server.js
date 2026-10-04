const express = require('express');
const { getDb, queryAll, queryOne, getStats, getRecentPolls } = require('../db');
const config = require('../config');
const logger = require('../utils/logger');

function startDashboard() {
  const app = express();
  app.use(express.json());

  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  // GET /api/requests — list tracked requests with optional filters
  app.get('/api/requests', async (req, res) => {
    try {
      await getDb();
      const { state, discussion_added, label_added, limit = 100, offset = 0 } = req.query;

      let sql = 'SELECT * FROM processed_requests WHERE 1=1';
      const params = [];

      if (state !== undefined)             { sql += ' AND state_id = ?';        params.push(Number(state)); }
      if (discussion_added !== undefined)  { sql += ' AND discussion_added = ?'; params.push(Number(discussion_added)); }
      if (label_added !== undefined)       { sql += ' AND label_added = ?';      params.push(Number(label_added)); }

      sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(Number(limit), Number(offset));

      const rows  = queryAll(sql, params);
      const count = queryOne('SELECT COUNT(*) as c FROM processed_requests');

      res.json({ total: count?.c ?? 0, rows });
    } catch (err) {
      logger.error('GET /api/requests error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/stats — summary statistics
  app.get('/api/stats', async (_req, res) => {
    try {
      await getDb();
      const stats      = getStats();
      const fullyDone  = queryOne(
        'SELECT COUNT(*) as c FROM processed_requests WHERE discussion_added=1 AND label_added=1'
      );
      const recentPolls = getRecentPolls(20);

      res.json({
        total:        stats.total       ?? 0,
        discussionDone: stats.discussions ?? 0,
        labelDone:    stats.labels       ?? 0,
        fullyDone:    fullyDone?.c       ?? 0,
        recentPolls,
      });
    } catch (err) {
      logger.error('GET /api/stats error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/polls — recent poll history
  app.get('/api/polls', async (_req, res) => {
    try {
      await getDb();
      const rows = getRecentPolls(50);
      res.json({ rows });
    } catch (err) {
      logger.error('GET /api/polls error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(config.dashboard.port, () => {
    logger.info(`Dashboard API running on http://localhost:${config.dashboard.port}`);
  });
}

module.exports = { startDashboard };
