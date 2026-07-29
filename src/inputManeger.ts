import { requireElement } from "./domUtils";
import { ROTATION_PLANES } from "./iFourDFigure";
import type { FourDFigure, RotationPlane } from "./iFourDFigure";
import type { ShapeDefinition } from "./shapes";

const deg2rad = (d: number): number => (d * Math.PI) / 180;
const rad2deg = (r: number): number => (r * 180) / Math.PI;

// Wraps any angle into [-180, 180) so it always matches the slider's range.
const normalizeDegrees = (deg: number): number => {
  let d = deg % 360;

  if (d < -180) {
    d += 360;
  } else if (d >= 180) {
    d -= 360;
  }

  return Object.is(d, -0) ? 0 : d;
};

/** Radians added per frame, per plane, while auto-rotate is on. The three
 *  speeds are deliberately different so the rotations don't sync up into
 *  a short repeating loop. */
const AUTO_ROTATE_SPEED: Readonly<Record<RotationPlane, number>> = {
  xw: 0.006,
  yw: 0.004,
  zw: 0.005,
};

/**
 * Owns every HUD control in `index.html` and keeps them in step with the
 * figure on screen: the three plane sliders, the auto-rotate toggle, the
 * reset button, and the two bits of text that name the current figure
 * (the title and the legend).
 *
 * The figure it drives can be swapped at any time with `setFigure`, which
 * is what the shape picker does.
 */
export class InputManager {
  private readonly sliders: Record<RotationPlane, HTMLInputElement>;
  private readonly readouts: Record<RotationPlane, HTMLElement>;
  private readonly autoRotateBox: HTMLInputElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly figureName: HTMLElement;
  private readonly legend: HTMLElement;
  private readonly legendLabel: HTMLElement;

  // Lets `dispose()` drop every listener in one call.
  private readonly listeners = new AbortController();

  private figure: FourDFigure;

  /**
   * @param figure The figure the controls start out driving.
   * @param shape That figure's definition, used for the title and legend.
   */
  constructor(figure: FourDFigure, shape: ShapeDefinition) {
    this.figure = figure;

    this.sliders = {
      xw: requireElement("#xwSlider", HTMLInputElement),
      yw: requireElement("#ywSlider", HTMLInputElement),
      zw: requireElement("#zwSlider", HTMLInputElement),
    };
    this.readouts = {
      xw: requireElement("#xwValue", HTMLElement),
      yw: requireElement("#ywValue", HTMLElement),
      zw: requireElement("#zwValue", HTMLElement),
    };
    this.autoRotateBox = requireElement("#autoRotate", HTMLInputElement);
    this.resetBtn = requireElement("#resetBtn", HTMLButtonElement);
    this.figureName = requireElement("#figureName", HTMLElement);
    this.legend = requireElement("#legend", HTMLElement);
    this.legendLabel = requireElement("#legendLabel", HTMLElement);

    const { signal } = this.listeners;

    for (const plane of ROTATION_PLANES) {
      this.sliders[plane].addEventListener(
        "input",
        () => {
          const degrees = Number(this.sliders[plane].value);
          this.readouts[plane].textContent = `${degrees}°`;
          this.figure.setRotation(plane, deg2rad(degrees));
        },
        { signal },
      );
    }

    this.resetBtn.addEventListener("click", () => this.reset(), { signal });
    this.autoRotateBox.addEventListener(
      "change",
      () => this.applyAutoRotateState(),
      { signal },
    );

    this.applyAutoRotateState();
    this.describe(shape);
    this.syncControlsToFigure();
  }

  /**
   * Advance the auto-rotation by one frame. Call this once per animation
   * frame; it does nothing while auto-rotate is switched off, which is
   * what leaves the sliders in charge.
   */
  public update(): void {
    if (!this.autoRotateBox.checked) return;

    // One `rotate` call rather than three `rotateOnPlane` calls so the
    // figure only rebuilds its geometry once per frame.
    this.figure.rotate(
      AUTO_ROTATE_SPEED.xw,
      AUTO_ROTATE_SPEED.yw,
      AUTO_ROTATE_SPEED.zw,
    );
    this.syncControlsToFigure();
  }

  /**
   * Point the controls at a different figure - used when the shape picker
   * swaps one in. The current rotation is carried over so switching shape
   * doesn't snap the view back to zero.
   */
  public setFigure(figure: FourDFigure, shape: ShapeDefinition): void {
    for (const plane of ROTATION_PLANES) {
      figure.setRotation(plane, this.figure.getRotation(plane));
    }

    this.figure = figure;
    this.describe(shape);
    this.syncControlsToFigure();
  }

  /** Return the figure to its un-rotated orientation. */
  public reset(): void {
    for (const plane of ROTATION_PLANES) {
      this.figure.setRotation(plane, 0);
    }
    this.syncControlsToFigure();
  }

  /** Stop listening to the controls. */
  public dispose(): void {
    this.listeners.abort();
  }

  // ── internals ────────────────────────────────────────────────────────

  /** Name the current figure in the title and the legend. The legend's
   *  `data-shape` is what gives its swatch the figure's own colour - see
   *  the `--shape-*` custom properties in `style.css`. */
  private describe(shape: ShapeDefinition): void {
    this.figureName.textContent = shape.label;
    this.legendLabel.textContent = shape.highlight;
    this.legend.dataset.shape = shape.id;
  }

  /** Push the figure's angles back into the sliders and readouts, so the
   *  panel keeps telling the truth while auto-rotate drives the figure. */
  private syncControlsToFigure(): void {
    for (const plane of ROTATION_PLANES) {
      const degrees = normalizeDegrees(
        Math.round(rad2deg(this.figure.getRotation(plane))),
      );

      // Plain number, no degree sign: a range input silently rejects any
      // value it can't parse and falls back to the middle of its range.
      this.sliders[plane].value = `${degrees}`;
      this.readouts[plane].textContent = `${degrees}°`;
    }
  }

  /** The sliders set absolute angles, so they'd fight the auto-rotation
   *  for control - disable them while it's running. */
  private applyAutoRotateState(): void {
    const disabled = this.autoRotateBox.checked;

    for (const plane of ROTATION_PLANES) {
      this.sliders[plane].disabled = disabled;
    }
  }
}
