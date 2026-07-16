function setJsonHeaders(res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Cron-Secret");
}

function sendJson(res, status, body) {
  setJsonHeaders(res);
  res.status(status).send(JSON.stringify(body));
}

function sendError(res, error, fallbackStatus = 500) {
  const status = Number(error?.status) || fallbackStatus;
  const message = error instanceof Error ? error.message : String(error || "Unexpected error");
  sendJson(res, status, { error: message });
}

function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  setJsonHeaders(res);
  res.status(204).end();
  return true;
}

function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.resolve({});
    }
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

module.exports = {
  handleOptions,
  readJsonBody,
  sendError,
  sendJson,
};
