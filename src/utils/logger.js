function formatDate() {
  return new Date().toISOString();
}

const logger = {
  info: (...args) => console.log(`[${formatDate()}] [INFO]`, ...args),
  warn: (...args) => console.warn(`[${formatDate()}] [WARN]`, ...args),
  error: (...args) => console.error(`[${formatDate()}] [ERROR]`, ...args),
  debug: (...args) => {
    if (process.env.DEBUG === 'true') {
      console.log(`[${formatDate()}] [DEBUG]`, ...args);
    }
  },
};

module.exports = logger;
