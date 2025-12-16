"use strict";

const http = require("http");
const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = process.env.UPDATE_API_PORT ? Number(process.env.UPDATE_API_PORT) : 9876;
const HOST = "127.0.0.1";

const UPDATE_SCRIPT = "/opt/printer-ui/scripts/update.sh";
const DATA_DIR = "/opt/printer-ui/data";
const LOG_FILE = path.join(DATA_DIR, "update.log");
const PID_FILE = path.join(DATA_DIR, "update.pid");
const START_FILE = path.join(DATA_DIR, "update.startedAt");

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function safeWrite(file, content) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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

function runScript(args, cb) {
  execFile(UPDATE_SCRIPT, args, { timeout: 20000 }, (err, stdout, stderr) => {
    if (err) return cb(err, stdout, stderr);
    cb(null, stdout, stderr);
  });
}

function startUpdateAsync() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const startedAt = new Date().toISOString();
  safeWrite(START_FILE, startedAt + "\n");

  // spawn update script; redirect stdout/stderr to LOG_FILE
  const out = fs.openSync(LOG_FILE, "a");
  const err = fs.openSync(LOG_FILE, "a");

  const child = spawn(UPDATE_SCRIPT, ["run"], {
    detached: true,
    stdio: ["ignore", out, err],
  });

  safeWrite(PID_FILE, String(child.pid) + "\n");

  // allow parent to exit independently
  child.unref();

  return { pid: child.pid, startedAt };
}

const server = http.createServer((req, res) => {
  // health
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true });
  }

  // GET /update/check -> JSON from update.sh check
  if (req.method === "GET" && req.url === "/update/check") {
    return runScript(["check"], (err, stdout, stderr) => {
      if (err) {
        return sendJson(res, 500, { ok: false, error: stderr || err.message || "check failed" });
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(stdout);
    });
  }

  // GET /update/status -> running + pid + startedAt + log tail
  if (req.method === "GET" && req.url === "/update/status") {
    try {
      const pidStr = safeRead(PID_FILE).trim();
      const pid = pidStr ? Number(pidStr) : null;

      const running = pid ? isPidRunning(pid) : false;
      const startedAt = safeRead(START_FILE).trim() || null;

      // For simplicity return full log; UI can limit display.
      // If you want tail only, we can slice it.
      const log = safeRead(LOG_FILE);

      return sendJson(res, 200, {
        ok: true,
        running,
        pid,
        startedAt,
        log,
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message || "status failed" });
    }
  }

  // POST /update/run -> start update (if not already running)
  if (req.method === "POST" && req.url === "/update/run") {
    try {
      const pidStr = safeRead(PID_FILE).trim();
      const pid = pidStr ? Number(pidStr) : null;

      if (pid && isPidRunning(pid)) {
        const startedAt = safeRead(START_FILE).trim() || null;
        return sendJson(res, 200, { ok: true, alreadyRunning: true, pid, startedAt });
      }

      const started = startUpdateAsync();
      return sendJson(res, 200, { ok: true, ...started });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message || "run failed" });
    }
  }

  // POST /update/clear-log -> clears update.log
  if (req.method === "POST" && req.url === "/update/clear-log") {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(LOG_FILE, "");
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message || "clear-log failed" });
    }
  }

  return sendJson(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`printer-ui host update API listening on http://${HOST}:${PORT}`);
});
