export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type SwapStrategy =
  | "innerHTML"
  | "outerHTML"
  | "append"
  | "prepend"
  | "beforebegin"
  | "afterend";

export type TargetSpec = "self" | string;

export type ResponseKind = "html" | "json" | "text";

export type TransportKind = "http" | "ws";

export type BehaviorConfig = {
  /** If set, request is triggered on click/submit (or immediately for components). */
  method?: HttpMethod;
  get?: string;
  post?: string;
  put?: string;
  delete?: string;

  /** Transport to use for this request (defaults to global config). */
  transport?: TransportKind;
  /**
   * WebSocket endpoint URL, e.g. "ws://localhost:5179/ws".
   * Required when transport="ws" unless global config provides it.
   */
  wsUrl?: string;

  target?: TargetSpec;
  swap?: SwapStrategy;

  headers?: Record<string, string>;
  /** If true, logs debug output and emits extra warnings. */
  debug?: boolean;

  /** Optional: add/remove this class on target during request. */
  loadingClass?: string;
};

export type ComponentFactory<Props extends object = any> = (props: Props) => BehaviorConfig;

export type BetterHtmxEvent =
  | "beforeRequest"
  | "afterRequest"
  | "beforeSwap"
  | "afterSwap"
  | "error";

export type BetterHtmxConfig = {
  debug?: boolean;
  attributePrefix?: string; // default "bx-"
  useAttribute?: string; // default "use"
  propsAttribute?: string; // default "props"
  defaultSwap?: SwapStrategy; // default "innerHTML"
  defaultTarget?: TargetSpec; // default "self"
  defaultLoadingClass?: string; // default "bx-loading"
  /** Default transport for requests. */
  transport?: TransportKind; // default "http"
  /** Default WebSocket URL used when transport="ws". */
  wsUrl?: string;
};

export type BetterHtmxContext = {
  event: BetterHtmxEvent;
  el?: Element;
  config?: BehaviorConfig;

  request?: {
    method: HttpMethod;
    url: string;
    headers: Headers;
    body?: BodyInit | null;
    controller?: AbortController;
  };

  response?: {
    status: number;
    ok: boolean;
    kind: ResponseKind;
    rawText?: string;
    json?: unknown;
    headers: Headers;
  };

  swap?: {
    targetEl: Element;
    strategy: SwapStrategy;
    html: string;
  };

  error?: unknown;
};

export type BetterHtmx = {
  /** Define a reusable behavior used via `use="name"`. */
  define: (name: string, config: BehaviorConfig) => void;
  /** Define a lightweight server-driven component used via `use="Name"` + `props='{...}'`. */
  component: (name: string, factory: ComponentFactory) => void;
  /** Listen for lifecycle events. */
  on: (event: BetterHtmxEvent, handler: (ctx: BetterHtmxContext) => void) => () => void;

  /** Initialize scanning + MutationObserver (idempotent). */
  init: (root?: ParentNode) => void;
  /** Manually trigger processing of a specific element subtree. */
  process: (root: ParentNode) => void;
  /** Set global configuration. */
  configure: (cfg: Partial<BetterHtmxConfig>) => void;

  /** Programmatic request for advanced use-cases. */
  request: (el: Element, config: BehaviorConfig) => Promise<void>;
};
