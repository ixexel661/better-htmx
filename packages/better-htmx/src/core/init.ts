import type {
  BehaviorConfig,
  BetterHtmxConfig,
  BetterHtmxContext,
  SwapStrategy,
  TargetSpec,
  TransportKind,
} from "../types.js";
import { safeParseJson } from "../utils/json.js";
import { createLogger } from "../utils/log.js";
import { queryTarget } from "./dom.js";
import type { Hooks } from "./hooks.js";
import { parseBxConfig, parseUse } from "./parse.js";
import type { Registry } from "./registry.js";
import { doRequest } from "./request.js";
import { swapHtml } from "./swap.js";
import { doWsRequest } from "./ws-transport.js";

const DEFAULTS: Required<BetterHtmxConfig> = {
  debug: false,
  attributePrefix: "bx-",
  useAttribute: "use",
  propsAttribute: "props",
  defaultSwap: "innerHTML",
  defaultTarget: "self",
  defaultLoadingClass: "bx-loading",
  transport: "http",
  wsUrl: "",
};

type Runtime = {
  cfg: Required<BetterHtmxConfig>;
  hooks: Hooks;
  registry: Registry;
  observer?: MutationObserver;
  initialized: boolean;
  inflight: WeakMap<Element, AbortController>;
};

export function createRuntime(hooks: Hooks, registry: Registry) {
  const runtime: Runtime = {
    cfg: { ...DEFAULTS },
    hooks,
    registry,
    initialized: false,
    inflight: new WeakMap(),
  };

  function configure(cfg: Partial<BetterHtmxConfig>) {
    runtime.cfg = { ...runtime.cfg, ...cfg };
  }

  function resolveTarget(el: Element, target: TargetSpec | undefined): Element | null {
    const t = target ?? runtime.cfg.defaultTarget;
    if (t === "self") return el;
    return queryTarget(el.ownerDocument, t);
  }

  function resolveSwap(swap: SwapStrategy | undefined): SwapStrategy {
    return swap ?? runtime.cfg.defaultSwap;
  }

  function resolveLoadingClass(cfg: BehaviorConfig): string | undefined {
    return cfg.loadingClass ?? runtime.cfg.defaultLoadingClass;
  }

  function resolveTransport(cfg: BehaviorConfig): TransportKind {
    return cfg.transport ?? runtime.cfg.transport;
  }

  function resolveWsUrl(cfg: BehaviorConfig): string | null {
    return cfg.wsUrl ?? runtime.cfg.wsUrl ?? null;
  }

  async function request(el: Element, cfg: BehaviorConfig): Promise<void> {
    const debug = Boolean(runtime.cfg.debug || cfg.debug);
    const log = createLogger(debug);

    const controllerPrev = runtime.inflight.get(el);
    if (controllerPrev) controllerPrev.abort("BetterHTMX: superseded");
    const controller = new AbortController();
    runtime.inflight.set(el, controller);

    const targetEl = resolveTarget(el, cfg.target);
    if (!targetEl) {
      log.warn("Target not found.", { target: cfg.target, el });
      runtime.hooks.emit({ event: "error", el, config: cfg, error: new Error("Target not found") });
      return;
    }

    const loadingClass = resolveLoadingClass(cfg);
    if (loadingClass) targetEl.classList.add(loadingClass);

    try {
      const transport = resolveTransport(cfg);
      const res =
        transport === "ws"
          ? await doWsRequest(el, cfg, {
              wsUrl: (() => {
                const u = resolveWsUrl(cfg);
                if (!u)
                  throw new Error(
                    'WebSocket transport requires "wsUrl" (set globally via configure() or per behavior).'
                  );
                return u;
              })(),
              controller,
              hooksEmit: (ctx) => runtime.hooks.emit(ctx),
            })
          : await doRequest(el, cfg, {
              controller,
              hooksEmit: (ctx) => runtime.hooks.emit(ctx),
            });

      if (!res.ok) {
        runtime.hooks.emit({
          event: "error",
          el,
          config: cfg,
          response: {
            status: res.status,
            ok: res.ok,
            kind: res.kind,
            rawText: res.rawText,
            json: res.json,
            headers: res.headers,
          },
          error: new Error(`Request failed with ${res.status}`),
        });
      }

      if (res.kind === "html" || res.kind === "text") {
        const html = res.rawText ?? "";
        const strategy = resolveSwap(cfg.swap);

        const beforeSwap: BetterHtmxContext = {
          event: "beforeSwap",
          el,
          config: cfg,
          swap: { targetEl, strategy, html },
        };
        runtime.hooks.emit(beforeSwap);

        swapHtml(targetEl, strategy, html);

        const afterSwap: BetterHtmxContext = {
          event: "afterSwap",
          el,
          config: cfg,
          swap: { targetEl, strategy, html },
        };
        runtime.hooks.emit(afterSwap);
      } else {
        log.warn("JSON response received; no swap performed.", { el, cfg, json: res.json });
      }
    } catch (e) {
      if ((e as any)?.name === "AbortError") {
        log.debug("Request aborted.", e);
        return;
      }
      runtime.hooks.emit({ event: "error", el, config: cfg, error: e });
      log.error("Request error.", e);
    } finally {
      if (loadingClass) targetEl.classList.remove(loadingClass);
      if (runtime.inflight.get(el) === controller) runtime.inflight.delete(el);
    }
  }

  function collectActionConfig(el: Element): { kind: "bx" | "use"; cfg: BehaviorConfig } | null {
    const bx = parseBxConfig(el, runtime.cfg.attributePrefix);
    if (bx) return { kind: "bx", cfg: bx };

    const useName = parseUse(el, runtime.cfg.useAttribute);
    if (useName) {
      const behavior = runtime.registry.getBehavior(useName);
      if (behavior) return { kind: "use", cfg: behavior };

      const component = runtime.registry.getComponent(useName);
      if (component) {
        const propsRaw = el.getAttribute(runtime.cfg.propsAttribute);
        const parsed = safeParseJson(propsRaw);
        if (!parsed.ok) {
          createLogger(runtime.cfg.debug).warn(
            `Invalid props JSON for component "${useName}".`,
            parsed.error
          );
          return null;
        }
        const props = parsed.value ?? {};
        if (props && typeof props === "object") return { kind: "use", cfg: component(props) };
        createLogger(runtime.cfg.debug).warn(`Props for component "${useName}" must be an object.`);
        return null;
      }

      if (runtime.cfg.debug)
        createLogger(true).warn(`No behavior/component registered for use="${useName}".`, el);
    }

    return null;
  }

  function shouldHandleClick(el: Element): boolean {
    const bxAny =
      el.hasAttribute(`${runtime.cfg.attributePrefix}get`) ||
      el.hasAttribute(`${runtime.cfg.attributePrefix}post`) ||
      el.hasAttribute(`${runtime.cfg.attributePrefix}put`) ||
      el.hasAttribute(`${runtime.cfg.attributePrefix}delete`);
    const useAny = el.hasAttribute(runtime.cfg.useAttribute);
    return bxAny || useAny;
  }

  function process(root: ParentNode) {
    const selector = `[${runtime.cfg.useAttribute}]`;
    const els: Element[] = [];
    if (root instanceof Element && root.matches(selector)) els.push(root);
    els.push(...Array.from(root.querySelectorAll(selector)));
    for (const el of els) {
      const name = parseUse(el, runtime.cfg.useAttribute);
      if (!name) continue;
      if (runtime.registry.getComponent(name)) {
        const key = `bxComponentInit:${name}`;
        if ((el as any).__bx_flags?.[key]) continue;
        (el as any).__bx_flags = { ...(el as any).__bx_flags, [key]: true };
        const action = collectActionConfig(el);
        if (action) void request(el, action.cfg);
      }
    }
  }

  function init(root: ParentNode = document) {
    if (runtime.initialized) {
      process(root);
      return;
    }
    runtime.initialized = true;

    const doc = root instanceof Document ? root : document;

    doc.addEventListener(
      "click",
      (ev) => {
        const target = ev.target as Element | null;
        if (!target) return;
        const el = target.closest(
          `[${runtime.cfg.useAttribute}],` +
            `[${runtime.cfg.attributePrefix}get],` +
            `[${runtime.cfg.attributePrefix}post],` +
            `[${runtime.cfg.attributePrefix}put],` +
            `[${runtime.cfg.attributePrefix}delete]`
        );
        if (!el) return;
        if (!shouldHandleClick(el)) return;
        ev.preventDefault();
        const action = collectActionConfig(el);
        if (!action) return;
        void request(el, action.cfg);
      },
      true
    );

    doc.addEventListener(
      "submit",
      (ev) => {
        const form = ev.target as Element | null;
        if (!form) return;
        const el = form.closest("form");
        if (!el) return;
        const bx = parseBxConfig(el, runtime.cfg.attributePrefix);
        const useName = parseUse(el, runtime.cfg.useAttribute);
        if (!bx && !useName) return;
        ev.preventDefault();
        const action = collectActionConfig(el);
        if (!action) return;
        void request(el, action.cfg);
      },
      true
    );

    process(doc);

    runtime.observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of Array.from(m.addedNodes)) {
          if (!(n instanceof Element)) continue;
          process(n);
        }
      }
    });

    runtime.observer.observe(doc.documentElement, { childList: true, subtree: true });
  }

  return { runtime, configure, init, process, request };
}
