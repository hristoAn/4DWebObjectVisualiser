import { requireElement } from "./domUtils";
import { SHAPE_IDS, isShapeId, type ShapeId } from "./shapes";

export interface ShapePickerOptions {
  /** Which button starts out selected. */
  readonly initial: ShapeId;
  /** Called whenever the selection changes - never for a click on the
   *  button that is already active. */
  readonly onSelect: (shape: ShapeId) => void;
  /** The `.shape-toggle` group. Defaults to the one in `index.html`. */
  readonly root?: HTMLElement;
}

/**
 * The three-button toggle in the top-right corner that chooses which 4D
 * figure is on screen.
 *
 * It owns nothing but its own DOM: it reports the user's choice through
 * `onSelect` and leaves swapping the actual figure to the caller, so it
 * never has to know about three.js or the scene.
 */
export class ShapePicker {
  private readonly root: HTMLElement;
  private readonly buttons: ReadonlyMap<ShapeId, HTMLButtonElement>;
  private readonly onSelect: (shape: ShapeId) => void;

  // Lets `dispose()` drop the click listener in one call.
  private readonly listeners = new AbortController();

  private current: ShapeId;

  constructor(options: ShapePickerOptions) {
    this.root = options.root ?? requireElement(".shape-toggle", HTMLElement);
    this.onSelect = options.onSelect;
    this.current = options.initial;

    this.buttons = new Map(
      SHAPE_IDS.map((id) => [
        id,
        requireElement(
          `.shape-btn[data-shape="${id}"]`,
          HTMLButtonElement,
          this.root,
        ),
      ]),
    );

    // One listener on the group rather than three on the buttons: less to
    // unsubscribe, and it keeps working if the markup grows a 4th shape.
    this.root.addEventListener("click", this.handleClick, {
      signal: this.listeners.signal,
    });

    // The markup ships with a button pre-marked so there's no flash of
    // "nothing selected" before this runs; re-applying it here makes the
    // `initial` option authoritative if the two ever disagree.
    this.applySelection();
  }

  /** The shape currently selected in the toggle. */
  public get selected(): ShapeId {
    return this.current;
  }

  /** Select a shape as if the user had clicked its button, `onSelect`
   *  included. A no-op when that shape is already selected. */
  public select(shape: ShapeId): void {
    if (shape === this.current) return;

    this.current = shape;
    this.applySelection();
    this.onSelect(shape);
  }

  /** Stop listening for clicks. */
  public dispose(): void {
    this.listeners.abort();
  }

  // ── internals ────────────────────────────────────────────────────────

  private readonly handleClick = (event: Event): void => {
    if (!(event.target instanceof Element)) return;

    const button = event.target.closest(".shape-btn");
    if (!(button instanceof HTMLButtonElement)) return;

    const shape = button.dataset.shape;
    if (shape === undefined || !isShapeId(shape)) return;

    this.select(shape);
  };

  /** Paint the active button and tell assistive tech which one it is. */
  private applySelection(): void {
    for (const [id, button] of this.buttons) {
      const isActive = id === this.current;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    }
  }
}
