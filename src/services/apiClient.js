const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const apiClient = axios.create({
  baseURL: config.api.baseUrl,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    token: config.api.token,
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    logger.error(`API Error [${status}]:`, data?.ErrorMessage || error.message);
    return Promise.reject(error);
  }
);

module.exports = apiClient;
