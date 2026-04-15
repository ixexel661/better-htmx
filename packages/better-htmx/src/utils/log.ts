export type Logger = {
  debug: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};

export function createLogger(enabled: boolean, namespace = "BetterHTMX"): Logger {
  const prefix = `[${namespace}]`;
  return {
    debug: (...args) => {
      if (!enabled) return;
      // eslint-disable-next-line no-console
      console.debug(prefix, ...args);
    },
    warn: (...args) => {
      // eslint-disable-next-line no-console
      console.warn(prefix, ...args);
    },
    error: (...args) => {
      // eslint-disable-next-line no-console
      console.error(prefix, ...args);
    },
  };
}
