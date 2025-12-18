// app/lib/logger.ts
// Centralized logging utility for better error tracking

type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  data?: any;
}

// In-memory log storage (ring buffer, max 500 entries to prevent memory issues)
const MAX_LOG_ENTRIES = 500;
const MAX_STACK_LINES = 20; // Limit stack trace to first 20 lines
const MAX_DATA_SIZE = 2000; // Max characters for data field
const logBuffer: LogEntry[] = [];

function truncateStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const lines = stack.split("\n");
  if (lines.length <= MAX_STACK_LINES) return stack;
  return lines.slice(0, MAX_STACK_LINES).join("\n") + `\n  ... (${lines.length - MAX_STACK_LINES} more lines)`;
}

function truncateData(data: any): any {
  if (!data) return data;
  
  try {
    const dataStr = typeof data === "string" ? data : JSON.stringify(data);
    if (dataStr.length <= MAX_DATA_SIZE) return data;
    
    // If it's a string, truncate it
    if (typeof data === "string") {
      return data.substring(0, MAX_DATA_SIZE) + `... (truncated, ${data.length} total chars)`;
    }
    
    // If it's an object, try to truncate nested strings
    if (typeof data === "object" && data !== null) {
      const truncated = Array.isArray(data) ? [...data] : { ...data };
      for (const key in truncated) {
        if (typeof truncated[key] === "string" && truncated[key].length > 500) {
          truncated[key] = truncated[key].substring(0, 500) + `... (truncated)`;
        }
      }
      const finalStr = JSON.stringify(truncated);
      if (finalStr.length > MAX_DATA_SIZE) {
        return JSON.parse(finalStr.substring(0, MAX_DATA_SIZE) + `"... (truncated)"`);
      }
      return truncated;
    }
    
    return data;
  } catch {
    return "[unable to process data]";
  }
}

function addToBuffer(entry: LogEntry) {
  // Optimize entry size before storing
  const optimizedEntry: LogEntry = {
    ...entry,
    error: entry.error ? {
      ...entry.error,
      stack: truncateStack(entry.error.stack),
    } : undefined,
    data: truncateData(entry.data),
  };
  
  logBuffer.push(optimizedEntry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift(); // Remove oldest entry
  }
}

export function getLogs(limit: number = MAX_LOG_ENTRIES): LogEntry[] {
  return logBuffer.slice(-limit);
}

export function clearLogs() {
  logBuffer.length = 0;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.context ? `[${entry.context}]` : "",
    entry.message,
  ].filter(Boolean);

  let logLine = parts.join(" ");

  if (entry.error) {
    logLine += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
    if (entry.error.code) {
      logLine += ` (code: ${entry.error.code})`;
    }
    if (entry.error.stack) {
      logLine += `\n  Stack: ${entry.error.stack}`;
    }
  }

  if (entry.data) {
    try {
      const dataStr = typeof entry.data === "string" 
        ? entry.data 
        : JSON.stringify(entry.data, null, 2);
      logLine += `\n  Data: ${dataStr}`;
    } catch {
      logLine += `\n  Data: [unable to stringify]`;
    }
  }

  return logLine;
}

export function logInfo(message: string, context?: string, data?: any) {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level: "info",
    message,
    context,
    data,
  };
  addToBuffer(entry);
  console.log(formatLogEntry(entry));
}

export function logWarn(message: string, context?: string, data?: any) {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level: "warn",
    message,
    context,
    data,
  };
  addToBuffer(entry);
  console.warn(formatLogEntry(entry));
}

export function logError(
  message: string,
  error?: Error | unknown,
  context?: string,
  data?: any
) {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level: "error",
    message,
    context,
    data,
  };

  if (error instanceof Error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    };
  } else if (error) {
    entry.error = {
      name: "UnknownError",
      message: String(error),
    };
  }

  addToBuffer(entry);
  console.error(formatLogEntry(entry));
}

export function logDebug(message: string, context?: string, data?: any) {
  if (process.env.NODE_ENV === "development") {
    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level: "debug",
      message,
      context,
      data,
    };
    addToBuffer(entry);
    console.debug(formatLogEntry(entry));
  }
}

// Helper to log API errors with full context
export function logApiError(
  route: string,
  method: string,
  error: Error | unknown,
  requestData?: any
) {
  logError(
    `API Error in ${method} ${route}`,
    error,
    "API",
    {
      route,
      method,
      requestData: requestData ? sanitizeData(requestData) : undefined,
    }
  );
}

// Helper to sanitize sensitive data from logs
export function sanitizeData(data: any): any {
  if (!data || typeof data !== "object") return data;

  const sensitiveKeys = ["password", "token", "apiKey", "authorization"];
  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key in sanitized) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}

