import type { BehaviorConfig, SwapStrategy, TargetSpec } from "../types.js";

export function parseBxConfig(el: Element, attributePrefix: string): BehaviorConfig | null {
  const get = el.getAttribute(`${attributePrefix}get`);
  const post = el.getAttribute(`${attributePrefix}post`);
  const put = el.getAttribute(`${attributePrefix}put`);
  const del = el.getAttribute(`${attributePrefix}delete`);

  if (!get && !post && !put && !del) return null;

  const target = (el.getAttribute(`${attributePrefix}target`) || undefined) as
    | TargetSpec
    | undefined;
  const swap = (el.getAttribute(`${attributePrefix}swap`) || undefined) as SwapStrategy | undefined;

  const headersRaw = el.getAttribute(`${attributePrefix}headers`);
  let headers: Record<string, string> | undefined;
  if (headersRaw) {
    try {
      const v = JSON.parse(headersRaw);
      if (v && typeof v === "object") headers = v;
    } catch {
      // ignore
    }
  }

  return {
    get: get || undefined,
    post: post || undefined,
    put: put || undefined,
    delete: del || undefined,
    target,
    swap,
    headers,
  };
}

export function parseUse(el: Element, useAttribute: string): string | null {
  const name = el.getAttribute(useAttribute);
  if (!name) return null;
  return name.trim() || null;
}
