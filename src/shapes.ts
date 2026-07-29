import type { FourDFigure } from "./iFourDFigure";
import { Tesseract } from "./tesseract";
import { HyperSphere } from "./hyperSphere";
import { HyperPyramid } from "./hyperPyramid";

/** Every figure the app can show, in the order they appear in the shape
 *  toggle. Doubles as the runtime guard for `data-shape` attributes. */
export const SHAPE_IDS = ["tesseract", "hypersphere", "hyperpyramid"] as const;

export type ShapeId = (typeof SHAPE_IDS)[number];

/** Everything the UI needs to know about one figure. Keeping it in a
 *  single record means adding a fourth figure is one entry here plus one
 *  button in `index.html` - no other file has to learn about it. */
export interface ShapeDefinition {
  /** Matches the `data-shape` attribute on the figure's toggle button and
   *  the `--shape-*` custom property that colours it. */
  readonly id: ShapeId;
  /** Name shown in the top-left title. */
  readonly label: string;
  /** What the shaded cell in the legend actually is - every figure
   *  highlights a different slice of itself. */
  readonly highlight: string;
  /** Builds a fresh figure. The caller owns the result and is
   *  responsible for calling `dispose()` on it. */
  readonly create: () => FourDFigure;
}

export const SHAPES: Readonly<Record<ShapeId, ShapeDefinition>> = {
  tesseract: {
    id: "tesseract",
    label: "Tesseract",
    highlight: "inner cell (w = −1)",
    create: () => new Tesseract(),
  },
  hypersphere: {
    id: "hypersphere",
    label: "HyperSphere",
    highlight: "equator shell (w = 0)",
    create: () => new HyperSphere(),
  },
  hyperpyramid: {
    id: "hyperpyramid",
    label: "HyperPyramid",
    highlight: "base cell (w = −1)",
    create: () => new HyperPyramid(),
  },
};

/** Narrows a raw string - typically a `data-shape` attribute read out of
 *  the DOM - to a known shape id. */
export function isShapeId(value: string): value is ShapeId {
  return SHAPE_IDS.includes(value as ShapeId);
}
