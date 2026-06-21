import { redactSecrets } from "./redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  level: LogLevel;
  message: string;
  requestId?: string;
  context?: Record<string, unknown>;
};

export type Logger = {
  log(entry: LogEntry): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
};

export function createConsoleLogger(requestId?: string): Logger {
  const write = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
    const entry: LogEntry = {
      level,
      message,
      requestId,
      context: context ? (redactSecrets(context) as Record<string, unknown>) : undefined
    };

    console[level === "debug" ? "debug" : level](JSON.stringify(entry));
  };

  return {
    log(entry) {
      write(entry.level, entry.message, entry.context);
    },
    debug(message, context) {
      write("debug", message, context);
    },
    info(message, context) {
      write("info", message, context);
    },
    warn(message, context) {
      write("warn", message, context);
    },
    error(message, context) {
      write("error", message, context);
    }
  };
}
