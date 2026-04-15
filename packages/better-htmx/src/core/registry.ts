import type { BehaviorConfig, ComponentFactory } from "../types.js";

export type Registry = ReturnType<typeof createRegistry>;

export function createRegistry() {
  const behaviors = new Map<string, BehaviorConfig>();
  const components = new Map<string, ComponentFactory>();

  function define(name: string, cfg: BehaviorConfig) {
    if (!name?.trim()) throw new Error("Behavior name is required.");
    behaviors.set(name, cfg);
  }

  function component(name: string, factory: ComponentFactory) {
    if (!name?.trim()) throw new Error("Component name is required.");
    components.set(name, factory);
  }

  function getBehavior(name: string): BehaviorConfig | undefined {
    return behaviors.get(name);
  }

  function getComponent(name: string): ComponentFactory | undefined {
    return components.get(name);
  }

  return { define, component, getBehavior, getComponent };
}
