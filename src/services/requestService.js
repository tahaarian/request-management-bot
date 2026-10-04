const apiClient = require('./apiClient');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Fetch list of requests from the API.
 * @param {object} params - optional extra query params
 */
async function getRequestList(params = {}) {
  const queryParams = {
    type: config.requests.listType,
    ...params,
  };

  const response = await apiClient.get('/Biz/Request/List', {
    params: queryParams,
  });

  const data = response.data;
  if (data.HasError) {
    throw new Error(`getRequestList API error: ${data.ErrorMessage}`);
  }

  return data.Result || [];
}

/**
 * Fetch detailed info for a single request.
 * @param {number} workItemId
 * @param {number} pId
 * @param {number} projectId
 */
async function getRequestInfo(workItemId, pId = 0, projectId = 0) {
  const response = await apiClient.get('/Biz/Request/Info', {
    params: { workItemId, pId, projectId },
  });

  const data = response.data;
  if (data.HasError) {
    throw new Error(`getRequestInfo API error [id=${workItemId}]: ${data.ErrorMessage}`);
  }

  return data.Result || null;
}

module.exports = { getRequestList, getRequestInfo };
