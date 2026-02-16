/**
 * Minimal DOM type stubs for WebDriverIO compatibility.
 *
 * The worker runs in Node.js (lib: ["es2022"], no DOM), but WebDriverIO's
 * `TransformReturn<T>` conditional type checks `T extends HTMLElement`. Without
 * a concrete `HTMLElement` definition, TypeScript resolves it as `any`, making
 * the condition always true and collapsing every `browser.execute()` return
 * type to `WebdriverIO.Element`.
 *
 * These stubs give `HTMLElement` enough structure so the conditional type only
 * matches actual DOM element returns, not plain objects, numbers, or booleans.
 */

declare class HTMLElement extends Element {}

declare class Element {
  readonly tagName: string
  readonly innerHTML: string
}

declare class NodeListOf<T> extends Array<T> {}
