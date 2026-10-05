const { getRequestList, getRequestInfo } = require('../services/requestService');
const { addDiscussion, listDiscussions } = require('../services/discussionService');
const { addLabel } = require('../services/labelService');
const { getAccountManager } = require('../utils/accountManager');
const { getDb, isProcessed, upsertRequest, logPoll } = require('../db');
const config = require('../config');
const logger = require('../utils/logger');

// Confirmed field ID for bizId from FAMS FieldsInfo array (FieldId: 27079).
// Falls back to hardcoded value if not set in config.
const BIZ_ID_FIELD_ID = config.bizFieldId || 27079;

/** Check if our discussion text already exists in the discussion list */
function hasOurDiscussion(discussions) {
  return discussions.some(
    (d) => d.Content && d.Content.trim() === config.discussion.text.trim()
  );
}

/**
 * Extract the business ID from request info.
 *
 * The FAMS API returns FieldsInfo items with the key "FieldId" (PascalCase),
 * NOT "Id" as the Swagger schema suggests. We check both to be safe.
 *
 * @param {object|null} requestInfo  — Result from getRequestInfo()
 * @returns {string|null}
 */
function extractBizId(requestInfo) {
  const fieldsInfo = requestInfo?.FieldsInfo;
  if (!Array.isArray(fieldsInfo) || fieldsInfo.length === 0) return null;

  const field = fieldsInfo.find(
    // API reality: FieldId. Swagger schema says: Id. Check both.
    (f) => (f.FieldId ?? f.Id ?? f.fieldId) === BIZ_ID_FIELD_ID
  );
  if (!field) return null;

  const value = String(field.Value ?? field.value ?? '').trim();
  return value || null;
}

/** Process a single request: add discussion + label if not already done */
async function processRequest(requestItem) {
  const workItemId  = requestItem.Id;
  const workItemPId = requestItem.PId;
  const projectId   = requestItem.ProjectId || requestItem.ProjectInfo?.Id || 0;
  const stateId     = requestItem.StateInfo?.Id || requestItem.StateId || 0;
  const title       = requestItem.Name || requestItem.Title || '';

  // State filter
  if (
    config.requests.allowedStateIds.length > 0 &&
    !config.requests.allowedStateIds.includes(stateId)
  ) {
    logger.debug(`Skipping request ${workItemId} — state ${stateId} not in allowed list`);
    return;
  }

  const existing = isProcessed(workItemId);

  let discussionAdded = existing?.discussion_added === 1;
  let labelAdded      = existing?.label_added === 1;

  if (discussionAdded && labelAdded) {
    logger.debug(`Request ${workItemId} already fully processed, skipping`);
    return;
  }

  logger.info(`Processing request ${workItemId} (PId: ${workItemPId}, state: ${stateId})`);

  // Fetch full info to resolve bizId + account manager
  let bizId          = null;
  let accountManager = null;
  try {
    const requestInfo = await getRequestInfo(workItemId, workItemPId, projectId);
    bizId = extractBizId(requestInfo);

    if (bizId) {
      accountManager = getAccountManager(bizId);
      logger.info(`Request ${workItemId}: bizId=${bizId}, accountManager=${accountManager ?? 'not found'}`);
    } else {
      logger.warn(`Request ${workItemId}: bizId not found in FieldsInfo (FieldId ${BIZ_ID_FIELD_ID})`);
    }
  } catch (err) {
    logger.error(`Failed to fetch info for request ${workItemId}:`, err.message);
  }

  // ── Discussion ────────────────────────────────────────────────────────────

  // Check for existing discussion before adding
  if (!discussionAdded) {
    try {
      const discussions = await listDiscussions(workItemPId, projectId);
      if (hasOurDiscussion(discussions)) {
        logger.info(`Request ${workItemId}: discussion already present, marking done`);
        discussionAdded = true;
      }
    } catch (err) {
      logger.warn(`Could not list discussions for ${workItemId}: ${err.message}`);
    }
  }

  if (!discussionAdded) {
    try {
      await addDiscussion(workItemPId, config.discussion.text);
      logger.info(`✓ Discussion added to request ${workItemId}`);
      discussionAdded = true;
    } catch (err) {
      logger.error(`Failed to add discussion to request ${workItemId}:`, err.message);
    }
  }

  // ── Label ─────────────────────────────────────────────────────────────────

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
    bizId, accountManager, discussionAdded, labelAdded,
  });
}

/** Main poll cycle */
async function pollAndProcess() {
  // Ensure DB is ready (no-op after first call)
  await getDb();

  const pollStart    = new Date().toISOString();
  let newCount       = 0;
  let processedCount = 0;
  let pollError      = null;

  try {
    logger.info('Polling request list...');
    const requests = await getRequestList();
    logger.info(`Fetched ${requests.length} requests`);

    for (const req of requests) {
      const workItemId = req.Id;
      const stateId    = req.StateInfo?.Id || req.StateId || 0;
      const existing   = isProcessed(workItemId);

      if (!existing) newCount++;

      const needsWork =
        !existing ||
        existing.discussion_added === 0 ||
        existing.label_added === 0;

      const stateAllowed =
        config.requests.allowedStateIds.length === 0 ||
        config.requests.allowedStateIds.includes(stateId);

      if (needsWork && stateAllowed) {
        try {
          await processRequest(req);
          processedCount++;
        } catch (err) {
          logger.error(`Unexpected error processing request ${workItemId}:`, err.message);
        }
      }
    }

    logger.info(`Poll complete — new: ${newCount}, processed: ${processedCount}`);
  } catch (err) {
    pollError = err.message;
    logger.error('Poll cycle failed:', err.message);
  }

  logPoll({
    newCount,
    processedCount,
    totalFound: 0,
    error: pollError,
  });
}

module.exports = { pollAndProcess };
