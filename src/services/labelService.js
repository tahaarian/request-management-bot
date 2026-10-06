const apiClient = require('./apiClient');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Add a label (account manager name) to a request.
 * @param {number} workItemId
 * @param {string} labelName - the account manager name
 */
async function addLabel(workItemId, labelName) {
  const body = {
    WorkItemId: workItemId,
    LabelNames: [labelName], // must be string[], not string
  };

  if (config.discussion.creatorSsoId) {
    body.CreatorSsoId = config.discussion.creatorSsoId;
  }

  logger.debug(`addLabel payload: ${JSON.stringify(body)}`);

  const response = await apiClient.post('/Biz/Label/Add', body);
  const data = response.data;

  if (data.HasError) {
    throw new Error(`addLabel API error [workItemId=${workItemId}]: ${data.ErrorMessage}`);
  }

  return data.Result;
}

module.exports = { addLabel };
