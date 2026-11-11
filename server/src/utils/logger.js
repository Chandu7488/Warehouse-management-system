/**
 * StockPilot WMS - Minimal levelled logger.
 *
 * Writes single-line JSON entries to stdout/stderr so that log collectors
 * can parse them. Replace with a dedicated library (for example pino) if
 * advanced transports become necessary.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
const LEVELS = Object.freeze({ silent: 0, error: 1, warn: 2, info: 3, debug: 4 });
const activeLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

/**
 * Writes a log entry when the level is enabled.
 *
 * @param {'error'|'warn'|'info'|'debug'} level - Entry severity.
 * @param {string} message - Human readable message.
 * @param {Record<string, unknown>} [meta] - Additional structured data.
 * @returns {void}
 */
const write = (level, message, meta = {}) => {
  if (LEVELS[level] > activeLevel) {
    return;
  }
  const entry = JSON.stringify({ time: new Date().toISOString(), level, message, ...meta });
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(`${entry}\n`);
};

export const logger = Object.freeze({
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
});
