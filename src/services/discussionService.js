const apiClient = require('./apiClient');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Add a discussion to a request.
 * @param {number} workItemPId - the PId of the work item
 * @param {string} content - discussion text
 */
async function addDiscussion(workItemPId, content) {
  const body = {
    WorkItemPId: workItemPId,
    Content: content,
  };

  if (config.discussion.creatorSsoId) {
    body.CreatorSsoId = config.discussion.creatorSsoId;
  }

  logger.debug(`addDiscussion payload: ${JSON.stringify(body)}`);

  const response = await apiClient.post('/Biz/Discussion/Add', body);
  const data = response.data;

  if (data.HasError) {
    throw new Error(`addDiscussion API error [pId=${workItemPId}]: ${data.ErrorMessage}`);
  }

  return data.Result;
}

/**
 * List discussions for a request to check if our discussion already exists.
 * @param {number} workItemPId
 * @param {number} projectId
 */
async function listDiscussions(workItemPId, projectId = 0) {
  const response = await apiClient.get('/Biz/Discussion/List', {
    params: { workItemPId, projectId, offset: 0, size: 100 },
  });

  const data = response.data;
  if (data.HasError) {
    throw new Error(`listDiscussions API error [pId=${workItemPId}]: ${data.ErrorMessage}`);
  }

  return data.Result || [];
}

module.exports = { addDiscussion, listDiscussions };
