import type { SwapStrategy } from "../types.js";
import { parseHtmlToFragment } from "./dom.js";

export function swapHtml(targetEl: Element, strategy: SwapStrategy, html: string): void {
  const frag = parseHtmlToFragment(html);

  switch (strategy) {
    case "innerHTML": {
      targetEl.innerHTML = "";
      targetEl.append(frag);
      return;
    }
    case "outerHTML": {
      const nodes = Array.from(frag.childNodes);
      if (nodes.length === 0) {
        targetEl.replaceWith(document.createComment("BetterHTMX: empty outerHTML swap"));
        return;
      }
      targetEl.replaceWith(...nodes);
      return;
    }
    case "append": {
      targetEl.append(frag);
      return;
    }
    case "prepend": {
      targetEl.prepend(frag);
      return;
    }
    case "beforebegin": {
      targetEl.before(frag);
      return;
    }
    case "afterend": {
      targetEl.after(frag);
      return;
    }
    default: {
      const _never: never = strategy;
      throw new Error(`Unknown swap strategy: ${String(_never)}`);
    }
  }
}
