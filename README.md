# FAMS Request Bot

Automated Node.js service that monitors FAMS (FAMS API) for new requests and:
- Adds a configurable discussion comment to each new request
- Adds a label with the responsible **Account Manager** name based on the project's business ID

---

## Features

- Modular, clean project structure
- Polls the API every N seconds (configurable, default 10s)
- Detects new requests and avoids duplicate discussions/labels
- Maps business IDs to account managers via an Excel file
- SQLite database for state persistence across restarts
- Simple REST dashboard API for monitoring

---

## Requirements

- Node.js 18+
- npm

---

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/fams-request-bot.git
   cd fams-request-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set at minimum:
   - `API_TOKEN` — your FAMS API token
   - `DISCUSSION_TEXT` — the comment text to add
   - `BIZ_FIELD_ID` — the field ID in Request Info that holds the business identifier
   - `ALLOWED_STATE_IDS` — comma-separated state IDs to process (e.g. `1` for new)

4. **Add the account managers Excel file**

   Place your Excel file at the path specified by `ACCOUNT_MANAGER_EXCEL_PATH` (default: `./account_managers.xlsx`).

   The file must have at least two columns:
   | bizId | managerName |
   |-------|-------------|
   | 1001  | Ali Rezaei  |
   | 1002  | Sara Ahmadi |

   Column names are configurable via `EXCEL_BIZ_ID_COLUMN` and `EXCEL_MANAGER_NAME_COLUMN`.

5. **Run**
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `API_BASE_URL` | `https://famsapi.sandpod.ir` | FAMS API base URL |
| `API_TOKEN` | — | Your API token (required) |
| `POLL_INTERVAL_MS` | `10000` | Polling interval in milliseconds |
| `ALLOWED_STATE_IDS` | `1` | Comma-separated state IDs to process |
| `REQUEST_LIST_TYPE` | `1` | Request list type (1=received, 2=sent, 5=all-received) |
| `DISCUSSION_TEXT` | (Persian default) | Discussion text to post |
| `CREATOR_SSO_ID` | — | Your SSO ID for discussion/label authorship |
| `ACCOUNT_MANAGER_EXCEL_PATH` | `./account_managers.xlsx` | Path to the Excel mapping file |
| `EXCEL_BIZ_ID_COLUMN` | `bizId` | Excel column name for business ID |
| `EXCEL_MANAGER_NAME_COLUMN` | `managerName` | Excel column name for manager name |
| `BIZ_FIELD_ID` | — | Field ID in Request Info for business identifier |
| `DASHBOARD_PORT` | `3001` | Port for the dashboard REST API |
| `DB_PATH` | `./data/fams.db` | SQLite database file path |

---

## Dashboard API

| Endpoint | Description |
|---|---|
| `GET /api/requests` | List tracked requests (filterable by state, discussion_added, label_added) |
| `GET /api/stats` | Summary statistics |
| `GET /api/polls` | Recent poll history |

---

## Project Structure

```
src/
├── index.js              Entry point
├── config/index.js       Configuration loader
├── db/                   Database (SQLite) setup and migrations
├── services/             API client and per-resource service modules
├── processors/           Core business logic (poll → detect → act)
├── utils/                Logger, Excel/account manager helper
└── dashboard/            Express dashboard API
```

---

## License

MIT
