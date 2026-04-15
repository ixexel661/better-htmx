import type { BehaviorConfig, BetterHtmxContext, HttpMethod, ResponseKind } from "../types.js";

type WsLike = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open" | "message" | "error" | "close", listener: (ev: any) => void): void;
  removeEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (ev: any) => void
  ): void;
};

type WsRequestMessage = {
  id: string;
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type WsResponseMessage = {
  id: string;
  status: number;
  ok: boolean;
  kind: ResponseKind;
  headers?: Record<string, string>;
  body?: unknown;
};

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isBrowserWebSocketAvailable(): boolean {
  return typeof WebSocket !== "undefined";
}

async function createWs(url: string): Promise<WsLike> {
  if (isBrowserWebSocketAvailable()) {
    return new WebSocket(url) as any;
  }
  // Optional Node fallback via ws package (NOT a hard dependency).
  // If consumers want WS transport in Node, they can install `ws`.
  let mod: any;
  try {
    mod = await import("ws");
  } catch (_e) {
    throw new Error(
      'WebSocket transport in Node requires the "ws" package. Install it (e.g. `pnpm add ws`) or run in a browser.'
    );
  }
  const WS = mod.WebSocket ?? mod.default ?? mod;
  return new WS(url) as WsLike;
}

const connections = new Map<
  string,
  Promise<{ ws: WsLike; pending: Map<string, (msg: WsResponseMessage) => void> }>
>();

async function getConnection(url: string) {
  let p = connections.get(url);
  if (!p) {
    p = (async () => {
      const ws = await createWs(url);
      const pending = new Map<string, (msg: WsResponseMessage) => void>();

      const onMessage = (ev: any) => {
        const data = typeof ev?.data === "string" ? ev.data : ev?.toString?.();
        if (!data) return;
        let msg: WsResponseMessage | null = null;
        try {
          msg = JSON.parse(data);
        } catch {
          return;
        }
        if (!msg?.id) return;
        const resolve = pending.get(msg.id);
        if (!resolve) return;
        pending.delete(msg.id);
        resolve(msg);
      };

      ws.addEventListener("message", onMessage);
      return { ws, pending };
    })();
    connections.set(url, p);
  }
  return p;
}

function formDataToObject(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of fd.entries()) {
    const value = typeof v === "string" ? v : v.name;
    const cur = out[k];
    if (cur === undefined) out[k] = value;
    else if (Array.isArray(cur)) cur.push(value);
    else out[k] = [cur, value];
  }
  return out;
}

export async function doWsRequest(
  el: Element,
  cfg: BehaviorConfig,
  opts: {
    wsUrl: string;
    controller?: AbortController;
    hooksEmit?: (ctx: BetterHtmxContext) => void;
  }
): Promise<{
  status: number;
  ok: boolean;
  kind: ResponseKind;
  headers: Headers;
  rawText?: string;
  json?: unknown;
}> {
  const url = cfg.get || cfg.post || cfg.put || cfg.delete;
  const method: HttpMethod = cfg.get
    ? "GET"
    : cfg.post
      ? "POST"
      : cfg.put
        ? "PUT"
        : cfg.delete
          ? "DELETE"
          : "GET";
  if (!url) throw new Error("No method/url provided (expected get/post/put/delete).");

  const { ws, pending } = await getConnection(opts.wsUrl);
  if (opts.controller?.signal.aborted) throw new DOMException("Aborted", "AbortError");

  const headers = new Headers(cfg.headers || {});

  let body: unknown;
  const form = el.closest("form");
  if (form && method !== "GET") {
    body = formDataToObject(new FormData(form as HTMLFormElement));
  }

  const beforeCtx: BetterHtmxContext = {
    event: "beforeRequest",
    el,
    config: cfg,
    request: { method, url, headers, body: body as any, controller: opts.controller },
  };
  opts.hooksEmit?.(beforeCtx);

  const id = randomId();
  const reqMsg: WsRequestMessage = {
    id,
    method,
    url,
    headers: Object.fromEntries(headers.entries()),
    body,
  };

  const p = new Promise<WsResponseMessage>((resolve, reject) => {
    pending.set(id, resolve);
    const onAbort = () => {
      pending.delete(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    opts.controller?.signal.addEventListener("abort", onAbort, { once: true });
  });

  ws.send(JSON.stringify(reqMsg));

  const resMsg = await p;
  const resHeaders = new Headers(resMsg.headers || {});

  const out = {
    status: resMsg.status,
    ok: resMsg.ok,
    kind: resMsg.kind,
    headers: resHeaders,
    rawText: undefined as string | undefined,
    json: undefined as unknown,
  };

  if (resMsg.kind === "json") out.json = resMsg.body;
  else out.rawText = typeof resMsg.body === "string" ? resMsg.body : String(resMsg.body ?? "");

  const afterCtx: BetterHtmxContext = {
    event: "afterRequest",
    el,
    config: cfg,
    request: { method, url, headers, body: body as any, controller: opts.controller },
    response: {
      status: out.status,
      ok: out.ok,
      kind: out.kind,
      rawText: out.rawText,
      json: out.json,
      headers: out.headers,
    },
  };
  opts.hooksEmit?.(afterCtx);

  return out;
}
