# BetterHTMX

BetterHTMX is a **small, dependency-free** TypeScript library for **HTML over the wire**: your server returns HTML (or text), BetterHTMX performs requests and **swaps** DOM regions declaratively — no framework, no virtual DOM, no reactivity.

## Philosophy

- **HTML-first**: UI primarily comes from the server.
- **Minimal JS glue**: only add JS where interactions are needed.
- **Not a framework**: no component hierarchies, no state management, no VDOM.
- **Good DX**: clear attributes, types, hooks, debug mode.

## Installation

```bash
pnpm add better-htmx
```

## Quickstart

### 1) `bx-*` attributes (HTMX-like)

```html
<button bx-post="/api/save" bx-target="#result" bx-swap="innerHTML">
  Save
</button>
<div id="result"></div>
```

### 2) Reusable Behaviors via `use="..."`

```html
<button use="saveButton">Save</button>
<div id="result2"></div>
```

```ts
import { betterHtmx } from "betterhtmx";

betterHtmx.define("saveButton", {
  post: "/api/save",
  target: "#result2",
  swap: "innerHTML",
});
```

### 3) Lightweight Components (server-driven)

```html
<div use="UserCard" props='{"id":1}'></div>
```

```ts
betterHtmx.component("UserCard", (props) => ({
  get: `/api/users/${props.id}`,
  target: "self",
  swap: "outerHTML",
}));
```

## WebSocket Transport (optional)

BetterHTMX can optionally execute requests over WebSockets:

```ts
betterHtmx.define("saveButtonWs", {
  transport: "ws",
  wsUrl: "ws://localhost:5179/ws",
  post: "/api/save",
  target: "#resultWs",
  swap: "innerHTML",
});
```

- In the **browser**, BetterHTMX uses the native `WebSocket` API.
- In **Node**, `ws` is **optional** (not a library dependency). If you want WS transport in Node, install `ws` in your app: `pnpm add ws`.

## API (short)

- `betterHtmx.configure({...})`
- `betterHtmx.define(name, config)`
- `betterHtmx.component(name, factory)`
- `betterHtmx.on(event, handler)`
- `betterHtmx.init()`

## License

MIT

