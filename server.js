// server.js
// Finqy — BT Top-Up Advisor backend.
// Deliberately built on Node's built-in http/fs modules only, so it
// runs on a fresh Windows machine with nothing but Node.js installed:
// no "npm install", no native compilation, no internet needed to start.

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const store = require("./db/store");
const lendersRoutes = require("./routes/lenders");
const checkRoutes = require("./routes/check");
const applicantsRoutes = require("./routes/applicants");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

store.init();

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);

  // guard against path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  const sendFile = (fp) => {
    fs.readFile(fp, (err, data) => {
      if (err) return sendNotFound();
      const ext = path.extname(fp);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  };

  const sendNotFound = () => {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // clean-URL fallback: "/bt-topup" -> "/bt-topup.html"
      if (!path.extname(filePath)) {
        return sendFile(filePath + ".html");
      }
      return sendNotFound();
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

// helper: build a lightweight response object compatible with the
// route handlers (status/json/end chaining like Express, but home-grown)
function wrapResponse(res) {
  res.status = function (code) {
    this._status = code;
    return this;
  };
  res.json = function (data) {
    sendJSON(this, this._status || 200, data);
  };
  // bare `.end()` calls (e.g. res.status(204).end()) need to actually
  // write the status header, since writeHead was never called for them
  const nativeEnd = res.end.bind(res);
  res.end = function (...args) {
    if (!this.headersSent) {
      this.writeHead(this._status || 200);
    }
    nativeEnd(...args);
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  wrapResponse(res);
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  try {
    // ---------- API routes ----------
    if (pathname === "/api/lenders" && req.method === "GET") {
      return lendersRoutes.list(req, res);
    }
    if (pathname === "/api/lenders" && req.method === "POST") {
      const body = await readBody(req);
      return lendersRoutes.create(req, res, body);
    }
    if (pathname.startsWith("/api/lenders/") && req.method === "PUT") {
      const id = decodeURIComponent(pathname.split("/")[3]);
      const body = await readBody(req);
      return lendersRoutes.update(req, res, body, id);
    }
    if (pathname.startsWith("/api/lenders/") && req.method === "DELETE") {
      const id = decodeURIComponent(pathname.split("/")[3]);
      return lendersRoutes.remove(req, res, id);
    }
    if (pathname === "/api/lenders-reset" && req.method === "POST") {
      return lendersRoutes.reset(req, res);
    }

    if (pathname === "/api/check" && req.method === "POST") {
      const body = await readBody(req);
      return checkRoutes.run(req, res, body);
    }
    if (pathname === "/api/check-refinance" && req.method === "POST") {
      const body = await readBody(req);
      return checkRoutes.runRefinance(req, res, body);
    }
    if (pathname === "/api/history" && req.method === "GET") {
      return checkRoutes.history(req, res);
    }
    if (pathname === "/api/history" && req.method === "DELETE") {
      return checkRoutes.clearHistory(req, res);
    }

    // ---------- applicants ----------
    if (pathname === "/api/applicants" && req.method === "GET") {
      return applicantsRoutes.list(req, res);
    }
    if (pathname === "/api/applicants" && req.method === "POST") {
      const body = await readBody(req);
      return applicantsRoutes.create(req, res, body);
    }
    if (pathname.startsWith("/api/applicants/") && req.method === "GET") {
      const id = decodeURIComponent(pathname.split("/")[3]);
      return applicantsRoutes.get(req, res, id);
    }
    if (pathname.startsWith("/api/applicants/") && req.method === "PUT") {
      const id = decodeURIComponent(pathname.split("/")[3]);
      const body = await readBody(req);
      return applicantsRoutes.update(req, res, body, id);
    }
    if (pathname.startsWith("/api/applicants/") && req.method === "DELETE") {
      const id = decodeURIComponent(pathname.split("/")[3]);
      return applicantsRoutes.remove(req, res, id);
    }

    // ---------- static frontend ----------
    if (req.method === "GET" || req.method === "HEAD") {
      return serveStatic(req, res, pathname);
    }

    sendJSON(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: err.message || "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Finqy — Loan Tools`);
  console.log(`  Server running at http://localhost:${PORT}\n`);
  console.log(`  Press Ctrl+C to stop.\n`);
});
