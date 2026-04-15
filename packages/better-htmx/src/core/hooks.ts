import type { BetterHtmxContext, BetterHtmxEvent } from "../types.js";

export type Hooks = ReturnType<typeof createHooks>;

export function createHooks() {
  const handlers = new Map<BetterHtmxEvent, Set<(ctx: BetterHtmxContext) => void>>();

  function on(event: BetterHtmxEvent, handler: (ctx: BetterHtmxContext) => void) {
    let set = handlers.get(event);
    if (!set) {
      set = new Set();
      handlers.set(event, set);
    }
    set.add(handler);
    return () => set?.delete(handler);
  }

  function emit(ctx: BetterHtmxContext) {
    const set = handlers.get(ctx.event);
    if (!set) return;
    for (const h of set) {
      try {
        h(ctx);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[BetterHTMX] hook handler error", e);
      }
    }
  }

  return { on, emit };
}
