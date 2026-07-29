/** Anything that can be used with `instanceof`, e.g. `HTMLInputElement`. */
type ElementClass<T extends Element> = abstract new () => T;

/**
 * Look up a required element and prove its type in one step.
 *
 * The whole HUD is authored in `index.html`, so a typo'd id would
 * otherwise show up much later as a confusing `null` or a control that
 * silently does nothing. Throwing here points straight at the markup.
 *
 * @param selector Any CSS selector, e.g. `"#xwSlider"`.
 * @param type The class the element is expected to be an instance of.
 * @param root Where to search. Defaults to the whole document.
 */
export function requireElement<T extends Element>(
  selector: string,
  type: ElementClass<T>,
  root: ParentNode = document,
): T {
  const element = root.querySelector(selector);

  if (element === null) {
    throw new Error(`No element matches "${selector}".`);
  }
  if (!(element instanceof type)) {
    throw new Error(
      `Element "${selector}" is a <${element.tagName.toLowerCase()}>, ` +
        `which is not the expected type.`,
    );
  }

  return element;
}
