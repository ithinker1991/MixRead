/**
 * Logger - Unified logging utility
 *
 * Provides consistent logging across the extension
 */

class Logger {
  static log(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] [MixRead] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [MixRead] ${message}`);
    }
  }

  static info(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
      console.info(`[${timestamp}] [MixRead INFO] ${message}`, data);
    } else {
      console.info(`[${timestamp}] [MixRead INFO] ${message}`);
    }
  }

  static warn(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
      console.warn(`[${timestamp}] [MixRead WARN] ${message}`, data);
    } else {
      console.warn(`[${timestamp}] [MixRead WARN] ${message}`);
    }
  }

  static error(message, error = null) {
    const timestamp = new Date().toISOString();
    if (error) {
      console.error(`[${timestamp}] [MixRead ERROR] ${message}`, error);
    } else {
      console.error(`[${timestamp}] [MixRead ERROR] ${message}`);
    }
  }

  static debug(message, data = null) {
    if (
      typeof localStorage !== "undefined" &&
      localStorage.getItem("mixread_debug")
    ) {
      const timestamp = new Date().toISOString();
      if (data) {
        console.debug(`[${timestamp}] [MixRead DEBUG] ${message}`, data);
      } else {
        console.debug(`[${timestamp}] [MixRead DEBUG] ${message}`);
      }
    }
  }
}

const logger = Logger;
