import { createHooks } from "./core/hooks.js";
import { createRuntime } from "./core/init.js";
import { createRegistry } from "./core/registry.js";
import type { BetterHtmx, BetterHtmxConfig } from "./types.js";

const hooks = createHooks();
const registry = createRegistry();
const { configure, init, process, request } = createRuntime(hooks, registry);

export const betterHtmx: BetterHtmx = {
  define: registry.define,
  component: registry.component,
  on: hooks.on,
  init,
  process,
  configure,
  request,
};

declare global {
  interface Window {
    betterHtmx?: BetterHtmx;
  }
}

// Optional global for dev ergonomics
if (typeof window !== "undefined") {
  window.betterHtmx = betterHtmx;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => betterHtmx.init(document), { once: true });
  } else {
    betterHtmx.init(document);
  }
}

export type { BetterHtmxConfig };
