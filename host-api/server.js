"use strict";

const http = require("http");
const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.UPDATE_API_PORT || 9876);
const HOST = process.env.UPDATE_API_HOST || "0.0.0.0";


const UPDATE_SCRIPT = "/opt/printer-ui/scripts/update.sh";
const DATA_DIR = "/opt/printer-ui/data";
const LOG_FILE = path.join(DATA_DIR, "update.log");
const PID_FILE = path.join(DATA_DIR, "update.pid");
const START_FILE = path.join(DATA_DIR, "update.startedAt");

/* ---------------- utilities ---------------- */

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function safeWrite(file, content) {
  ensureDataDir();
  fs.writeFileSync(file, content);
}

function isPidRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/* ---------------- script execution ---------------- */

/**
 * CHECK MODE
 * - runs: update.sh check
 * - MUST return JSON only
 */
function runCheck(res) {
  execFile(
    UPDATE_SCRIPT,
    ["check"],
    { timeout: 15000 },
    (err, stdout, stderr) => {
      if (err) {
        return sendJson(res, 500, {
          ok: false,
          error: String(stderr || err.message || err),
        });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(stdout.trim());
    }
  );
}

/**
 * RUN MODE (async)
 * - runs: update.sh run
 * - logs redirected to update.log
 */
function startUpdateAsync() {
  ensureDataDir();

  const startedAt = new Date().toISOString();
  safeWrite(START_FILE, startedAt + "\n");

  const out = fs.openSync(LOG_FILE, "a");
  const err = fs.openSync(LOG_FILE, "a");

  const child = spawn(UPDATE_SCRIPT, ["run"], {
    detached: true,
    stdio: ["ignore", out, err],
  });

  safeWrite(PID_FILE, String(child.pid) + "\n");
  child.unref();

  return { pid: child.pid, startedAt };
}

/* ---------------- HTTP server ---------------- */

const server = http.createServer((req, res) => {
  /* health */
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true });
  }

  /* GET /update/check */
  if (req.method === "GET" && req.url === "/update/check") {
    return runCheck(res);
  }

  /* GET /update/status */
  if (req.method === "GET" && req.url === "/update/status") {
    try {
      const pid = Number(safeRead(PID_FILE).trim()) || null;
      const running = pid ? isPidRunning(pid) : false;

      return sendJson(res, 200, {
        ok: true,
        running,
        pid,
        startedAt: safeRead(START_FILE).trim() || null,
        log: safeRead(LOG_FILE),
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  /* POST /update/run */
  if (req.method === "POST" && req.url === "/update/run") {
    try {
      const pid = Number(safeRead(PID_FILE).trim()) || null;
      if (pid && isPidRunning(pid)) {
        return sendJson(res, 200, {
          ok: true,
          alreadyRunning: true,
          pid,
          startedAt: safeRead(START_FILE).trim() || null,
        });
      }

      return sendJson(res, 200, {
        ok: true,
        ...startUpdateAsync(),
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  /* POST /update/clear-log */
  if (req.method === "POST" && req.url === "/update/clear-log") {
    try {
      ensureDataDir();
      fs.writeFileSync(LOG_FILE, "");
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  sendJson(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`printer-ui update API listening on http://${HOST}:${PORT}`);
});
