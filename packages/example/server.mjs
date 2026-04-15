import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, "..", "..");
const libDist = join(root, "packages", "better-htmx", "dist");

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function html(res, markup, status = 200) {
  send(res, status, { "content-type": "text/html; charset=utf-8" }, markup);
}

function notFound(res) {
  send(res, 404, { "content-type": "text/plain; charset=utf-8" }, "Not found");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    const file = await readFile(join(__dirname, "index.html"), "utf8");
    return html(res, file);
  }

  // Serve built library to the browser.
  if (url.pathname === "/betterhtmx/index.js") {
    const file = await readFile(join(libDist, "index.js"), "utf8");
    return send(res, 200, { "content-type": "text/javascript; charset=utf-8" }, file);
  }

  if (url.pathname === "/api/save" && req.method === "POST") {
    return html(res, `<strong>Gespeichert:</strong> ${new Date().toLocaleTimeString()}`);
  }

  if (url.pathname.startsWith("/api/users/") && req.method === "GET") {
    const id = url.pathname.split("/").pop() || "unknown";
    return html(
      res,
      `<div class="box"><strong>User #${id}</strong><div>Server-Zeit: ${new Date().toLocaleTimeString()}</div></div>`
    );
  }

  return notFound(res);
});

// --- WebSocket transport demo protocol ---
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (socket) => {
  socket.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString("utf8"));
    } catch {
      return;
    }
    if (!msg?.id) return;

    if (msg.url === "/api/save" && msg.method === "POST") {
      socket.send(
        JSON.stringify({
          id: msg.id,
          status: 200,
          ok: true,
          kind: "html",
          body: `<strong>Gespeichert (WS):</strong> ${new Date().toLocaleTimeString()}`,
        })
      );
      return;
    }

    if (typeof msg.url === "string" && msg.url.startsWith("/api/users/") && msg.method === "GET") {
      const id = msg.url.split("/").pop() || "unknown";
      socket.send(
        JSON.stringify({
          id: msg.id,
          status: 200,
          ok: true,
          kind: "html",
          body: `<div class="box"><strong>User #${id}</strong><div>Server-Zeit (WS): ${new Date().toLocaleTimeString()}</div></div>`,
        })
      );
      return;
    }

    socket.send(
      JSON.stringify({
        id: msg.id,
        status: 404,
        ok: false,
        kind: "text",
        body: "Not found",
      })
    );
  });
});

const port = Number(process.env.PORT || 5179);
server.listen(port, () => {
  console.log(`Demo: http://localhost:${port}`);
});
