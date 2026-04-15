export function closestForm(el: Element): HTMLFormElement | null {
  return el.closest("form");
}

export function isFormElement(el: Element): el is HTMLFormElement {
  return el instanceof HTMLFormElement;
}

export function isAnchor(el: Element): el is HTMLAnchorElement {
  return el instanceof HTMLAnchorElement;
}

export function queryTarget(root: ParentNode, target: string): Element | null {
  return root.querySelector(target);
}

export function parseHtmlToFragment(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}
