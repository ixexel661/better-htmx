import type { BehaviorConfig, BetterHtmxContext, HttpMethod, ResponseKind } from "../types.js";
import { closestForm, isAnchor, isFormElement } from "./dom.js";

function pickMethodAndUrl(el: Element, cfg: BehaviorConfig): { method: HttpMethod; url: string } {
  if (cfg.get) return { method: "GET", url: cfg.get };
  if (cfg.post) return { method: "POST", url: cfg.post };
  if (cfg.put) return { method: "PUT", url: cfg.put };
  if (cfg.delete) return { method: "DELETE", url: cfg.delete };
  if (cfg.method) {
    const url =
      (cfg as any).url ||
      (isAnchor(el) ? el.href : "") ||
      (isFormElement(el) ? el.action : "") ||
      "";
    return { method: cfg.method, url };
  }
  throw new Error("No method/url provided (expected get/post/put/delete).");
}

function shouldSendBody(method: HttpMethod): boolean {
  return method !== "GET";
}

function detectResponseKind(res: Response): ResponseKind {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) return "html";
  if (ct.includes("application/json") || ct.includes("+json")) return "json";
  return "text";
}

export type RequestResult = {
  status: number;
  ok: boolean;
  kind: ResponseKind;
  headers: Headers;
  rawText?: string;
  json?: unknown;
};

export async function doRequest(
  el: Element,
  cfg: BehaviorConfig,
  opts: {
    controller?: AbortController;
    extraHeaders?: HeadersInit;
    hooksEmit?: (ctx: BetterHtmxContext) => void;
  }
): Promise<RequestResult> {
  const { method, url } = pickMethodAndUrl(el, cfg);
  if (!url) throw new Error("Request URL is empty.");

  const controller = opts.controller;
  const headers = new Headers(cfg.headers || {});
  if (opts.extraHeaders) {
    const extra = new Headers(opts.extraHeaders);
    extra.forEach((v, k) => {
      headers.set(k, v);
    });
  }

  let body: BodyInit | null | undefined = null;

  const form = closestForm(el) || (isFormElement(el) ? el : null);
  if (form && shouldSendBody(method)) {
    body = new FormData(form);
  }

  const beforeCtx: BetterHtmxContext = {
    event: "beforeRequest",
    el,
    config: cfg,
    request: { method, url, headers, body, controller },
  };
  opts.hooksEmit?.(beforeCtx);

  const res = await fetch(url, {
    method,
    headers,
    body: shouldSendBody(method) ? (body ?? null) : undefined,
    signal: controller?.signal,
  });

  const kind = detectResponseKind(res);
  const out: RequestResult = { status: res.status, ok: res.ok, kind, headers: res.headers };

  if (kind === "json") out.json = await res.json().catch(() => undefined);
  else out.rawText = await res.text();

  const afterCtx: BetterHtmxContext = {
    event: "afterRequest",
    el,
    config: cfg,
    request: { method, url, headers, body, controller },
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
