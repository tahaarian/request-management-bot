// src/processors/requestProcessor.js

const { getRequestList, getRequestInfo } = require('../services/requestService');
// const { addDiscussion, listDiscussions }  = require('../services/discussionService'); // DISABLED
const { addLabel }                        = require('../services/labelService');
const { getAccountManager }              = require('../utils/accountManager');
const { getDb, isProcessed, upsertRequest, logPoll } = require('../db');
const config = require('../config');
const logger = require('../utils/logger');

const BIZ_ID_FIELD_ID = config.bizFieldId || 27079;

// ── Helpers ───────────────────────────────────────────────────────────────────

// function hasOurDiscussion(discussions) {
//   return discussions.some(
//     (d) => d.Content && d.Content.trim() === config.discussion.text.trim()
//   );
// }

function extractBizId(requestInfo) {
  const fieldsInfo = requestInfo?.FieldsInfo;
  if (!Array.isArray(fieldsInfo) || fieldsInfo.length === 0) return null;

  const field = fieldsInfo.find(
    (f) => (f.FieldId ?? f.Id ?? f.fieldId) === BIZ_ID_FIELD_ID
  );
  if (!field) return null;

  const value = String(field.Value ?? field.value ?? '').trim();
  return value || null;
}

function isNewState(requestItem) {
  const stateName = (
    requestItem.StateInfo?.Name  ||
    requestItem.StateInfo?.Title ||
    requestItem.StateName        ||
    ''
  ).toLowerCase().trim();

  if (stateName === 'new' || stateName === 'جدید') return true;

  const stateId = requestItem.StateInfo?.Id || requestItem.StateId || 0;

  const newIds = config.requests?.newStateIds;
  if (Array.isArray(newIds) && newIds.length > 0) {
    return newIds.includes(stateId);
  }

  const allowedIds = config.requests?.allowedStateIds;
  if (Array.isArray(allowedIds) && allowedIds.length > 0) {
    return allowedIds.includes(stateId);
  }

  return true;
}

// ── Core processor ────────────────────────────────────────────────────────────

async function processRequest(requestItem) {
  const workItemId  = requestItem.Id;
  const workItemPId = requestItem.PId;
  const projectId   = requestItem.ProjectId || requestItem.ProjectInfo?.Id || 0;
  const stateId     = requestItem.StateInfo?.Id || requestItem.StateId || 0;
  const title       = requestItem.Name || requestItem.Title || '';

  const existing = isProcessed(workItemId);
  let discussionAdded = existing?.discussion_added === 1;
  let labelAdded      = existing?.label_added      === 1;

  if (discussionAdded && labelAdded) {
    logger.debug(`Request ${workItemId} already fully processed, skipping`);
    return {
      bizId: existing?.biz_id ?? null,
      accountManager: existing?.account_manager ?? null,
      discussionAdded,
      labelAdded,
      alreadyDone: true,
    };
  }

  logger.info(`Processing request ${workItemId} (PId: ${workItemPId}, state: ${stateId})`);

  let bizId          = null;
  let accountManager = null;

  try {
    const requestInfo = await getRequestInfo(workItemId, workItemPId, projectId);
    bizId = extractBizId(requestInfo);

    if (bizId) {
      accountManager = getAccountManager(bizId);
      logger.info(
        `Request ${workItemId}: bizId=${bizId}, accountManager=${accountManager ?? 'not found'}`
      );
    } else {
      logger.warn(
        `Request ${workItemId}: bizId not found in FieldsInfo (FieldId ${BIZ_ID_FIELD_ID})`
      );
    }
  } catch (err) {
    logger.error(`Failed to fetch info for request ${workItemId}:`, err.message);
  }

  // ── Discussion (DISABLED) ───────────────────────────────────────────────────
  // if (!discussionAdded) {
  //   try {
  //     const discussions = await listDiscussions(workItemPId, projectId);
  //     if (hasOurDiscussion(discussions)) {
  //       logger.info(`Request ${workItemId}: discussion already present, marking done`);
  //       discussionAdded = true;
  //     }
  //   } catch (err) {
  //     logger.warn(`Could not list discussions for ${workItemId}: ${err.message}`);
  //   }
  // }
  //
  // if (!discussionAdded) {
  //   try {
  //     await addDiscussion(workItemPId, config.discussion.text);
  //     logger.info(`✓ Discussion added to request ${workItemId}`);
  //     discussionAdded = true;
  //   } catch (err) {
  //     logger.error(`Failed to add discussion to request ${workItemId}:`, err.message);
  //   }
  // }

  // ── Label ───────────────────────────────────────────────────────────────────
  if (!labelAdded && accountManager) {
    try {
      await addLabel(workItemId, accountManager);
      logger.info(`✓ Label "${accountManager}" added to request ${workItemId}`);
      labelAdded = true;
    } catch (err) {
      logger.error(`Failed to add label to request ${workItemId}:`, err.message);
    }
  } else if (!labelAdded && !accountManager) {
    logger.warn(
      `Request ${workItemId}: no account manager for bizId="${bizId ?? 'null'}", skipping label`
    );
  }

  upsertRequest({
    workItemId, workItemPId, projectId, stateId, title,
    bizId, accountManager,
    discussionAdded: false, // disabled
    labelAdded,
  });

  return { bizId, accountManager, discussionAdded: false, labelAdded, alreadyDone: false };
}

// ── Console summary table ─────────────────────────────────────────────────────

function printSummaryTable(rows) {
  if (rows.length === 0) return;

  const divider = '─'.repeat(82);
  console.log(`\n${divider}`);
  console.log('  Poll Summary');
  console.log(divider);

  console.table(
    rows.map((r) => ({
      'ID':      r.id,
      'Title':   r.title.length > 28 ? `${r.title.slice(0, 25)}…` : r.title,
      'State':   r.stateName ? `${r.stateName} (${r.stateId})` : String(r.stateId),
      'BizID':   r.bizId          ?? '—',
      'Manager': r.accountManager ?? '—',
      'Label':   r.labelAdded      ? '✓' : '✗',
      'Result':  r.result,
    }))
  );

  console.log(`${divider}\n`);
}

// ── Main poll cycle ───────────────────────────────────────────────────────────

async function pollAndProcess() {
  await getDb();

  let newCount       = 0;
  let processedCount = 0;
  let pollError      = null;
  const tableRows    = [];

  try {
    logger.info('Polling request list...');
    const requests = await getRequestList();
    logger.info(`Fetched ${requests.length} requests`);

    for (const req of requests) {
      const workItemId = req.Id;
      const stateId    = req.StateInfo?.Id || req.StateId || 0;
      const stateName  = req.StateInfo?.Name || req.StateInfo?.Title || '';
      const title      = req.Name || req.Title || '';
      const existing   = isProcessed(workItemId);

      if (!existing) newCount++;

      if (!isNewState(req)) {
        logger.debug(
          `Skipping request ${workItemId} — state "${stateName}" (${stateId}) is not "new"`
        );
        continue;
      }

      const needsWork =
        !existing ||
        existing.label_added === 0; // discussion disabled, only check label

      const row = {
        id:             workItemId,
        title,
        stateId,
        stateName,
        bizId:          existing?.biz_id          ?? null,
        accountManager: existing?.account_manager ?? null,
        discussionAdded: false,
        labelAdded:      existing?.label_added      === 1,
        result:          'already done',
      };

      if (needsWork) {
        try {
          const res = await processRequest(req);
          processedCount++;

          row.bizId          = res.bizId;
          row.accountManager = res.accountManager;
          row.labelAdded      = res.labelAdded;
          row.result          = res.alreadyDone ? 'already done' : 'processed';
        } catch (err) {
          logger.error(`Unexpected error processing request ${workItemId}:`, err.message);
          row.result = `error: ${err.message}`;
        }
      }

      tableRows.push(row);
    }

    printSummaryTable(tableRows);
    logger.info(`Poll complete — new: ${newCount}, processed: ${processedCount}`);
  } catch (err) {
    pollError = err.message;
    logger.error('Poll cycle failed:', err.message);
  }

  logPoll({
    newCount,
    processedCount,
    totalFound: tableRows.length,
    error: pollError,
  });
}

module.exports = { pollAndProcess };
