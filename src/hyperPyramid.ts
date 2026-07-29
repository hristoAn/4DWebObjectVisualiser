import * as THREE from "three";
import type { FourDFigure } from "./iFourDFigure";
import type { Vec4 } from "./iFourDFigure";
import type { RotationPlane } from "./iFourDFigure";

/**
 * A 4D "hyperpyramid": a cubic base (8 corners, laid out exactly like
 * one cell of a Tesseract) sitting at one extreme of the W axis, joined
 * to a single apex point sitting at the opposite extreme of W. It's the
 * direct 4D analogue of an ordinary 3D square pyramid, where the square
 * base becomes a cube and the apex is still just one point.
 */
export class HyperPyramid implements FourDFigure {
  /** Add this to your scene: `scene.add(hyperPyramid.group)`. */
  public readonly group: THREE.Group;

  /** How far the 4D "camera" sits along W. Must exceed the largest 4D
   *  distance-from-origin of any vertex (see note in the constructor). */
  public projectionDistance: number;

  // The 9 corners (8 base + 1 apex, index 8) in their original,
  // un-rotated 4D positions.
  private readonly baseVertices: Vec4[];

  // The rotation currently applied in each plane, in radians.
  private angles: { xw: number; yw: number; zw: number } = {
    xw: 0,
    yw: 0,
    zw: 0,
  };

  // Pairs of vertex indices connected by an edge: 12 for the cube base,
  // plus 8 connecting every base corner to the apex (index 8).
  private readonly edgeIndices: [number, number][];

  // The 6 faces of the base cube, each written as 4 corner indices in
  // perimeter order (so they can be split into 2 triangles each).
  // These indices are LOCAL to the first 8 entries of baseVertices -
  // same bit-trick and same face layout as Tesseract's inner cube.
  private readonly baseFaces: [number, number, number, number][] = [
    [0, 1, 3, 2], // z = -half face
    [4, 5, 7, 6], // z = +half face
    [0, 1, 5, 4], // y = -half face
    [2, 3, 7, 6], // y = +half face
    [0, 2, 6, 4], // x = -half face
    [1, 3, 7, 5], // x = +half face
  ];

  private lineGeometry: THREE.BufferGeometry;
  private lineMaterial: THREE.LineBasicMaterial;
  private baseFaceGeometry: THREE.BufferGeometry;
  private baseFaceMaterial: THREE.MeshBasicMaterial;
  private baseFaceMesh: THREE.Mesh;

  /**
   * @param baseSize How long one edge of the cube base is. Defaults to 2
   *   (base corners at +-1 on x, y and z).
   * @param height How far apart the base and the apex sit along W.
   *   Defaults to 2 (base at w = -1, apex at w = +1).
   * @param projectionDistance Distance of the 4D "camera" along W. Must
   *   be greater than the largest 4D distance-from-origin among the 9
   *   vertices - rotation preserves each vertex's distance from the
   *   origin, so that distance is the hard ceiling on how large |w| can
   *   ever get for it, no matter the rotation. Left undefined, a safe
   *   default (1.5x that ceiling) is computed for you.
   */
  constructor(baseSize = 2, height = 2, projectionDistance?: number) {
    this.group = new THREE.Group();

    // Build the 8 base corners: every combination of +-half in x, y, z,
    // all sitting at w = -halfHeight - plus the single apex at
    // w = +halfHeight, index 8.
    const half = baseSize / 2;
    const halfHeight = height / 2;
    this.baseVertices = [];
    for (let i = 0; i < 8; i++) {
      this.baseVertices.push({
        x: i & 1 ? half : -half,
        y: i & 2 ? half : -half,
        z: i & 4 ? half : -half,
        w: -halfHeight,
      });
    }
    this.baseVertices.push({ x: 0, y: 0, z: 0, w: halfHeight }); // apex

    // The base corners sit further from the origin than the apex does
    // (the apex has x = y = z = 0), so they set the safe default.
    const maxVertexRadius = Math.sqrt(
      3 * half * half + halfHeight * halfHeight,
    );
    this.projectionDistance = projectionDistance ?? maxVertexRadius * 1.5;

    // Build the 20 edges: 12 for the cube base (corners differing in
    // exactly one of the x/y/z bits), plus 8 connecting every base
    // corner to the apex.
    this.edgeIndices = [];
    for (let a = 0; a < 8; a++) {
      for (let b = a + 1; b < 8; b++) {
        const diff = a ^ b;
        const isSingleBit = diff !== 0 && (diff & (diff - 1)) === 0;
        if (isSingleBit) this.edgeIndices.push([a, b]);
      }
    }
    for (let a = 0; a < 8; a++) {
      this.edgeIndices.push([a, 8]);
    }

    // --- wireframe: all 20 edges, as one LineSegments object ---
    this.lineGeometry = new THREE.BufferGeometry();
    this.lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(this.edgeIndices.length * 2 * 3),
        3,
      ),
    );
    this.lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const lineSegments = new THREE.LineSegments(
      this.lineGeometry,
      this.lineMaterial,
    );
    this.group.add(lineSegments);

    // --- base cube: 6 faces, transparent light orange ---
    this.baseFaceGeometry = new THREE.BufferGeometry();
    this.baseFaceGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(this.baseFaces.length * 6 * 3),
        3,
      ),
    );
    this.baseFaceMaterial = new THREE.MeshBasicMaterial({
      color: 0xffa07a, // light salmon
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide, // visible from inside AND outside
      depthWrite: false, // avoids see-through sorting glitches
    });
    this.baseFaceMesh = new THREE.Mesh(
      this.baseFaceGeometry,
      this.baseFaceMaterial,
    );
    this.group.add(this.baseFaceMesh);

    this.updateGeometry(); // draw the initial, un-rotated shape
  }

  public rotateOnPlane(radians: number, plane: RotationPlane): void {
    switch (plane) {
      case "xw":
        this.angles.xw += radians;
        break;
      case "yw":
        this.angles.yw += radians;
        break;
      case "zw":
        this.angles.zw += radians;
        break;
    }
    this.updateGeometry();
  }

  /** Nudge all three planes at once - handy in an animation loop so you
   *  only recompute the geometry once per frame instead of three times. */
  public rotate(deltaXW: number, deltaYW: number, deltaZW: number): void {
    this.angles.xw += deltaXW;
    this.angles.yw += deltaYW;
    this.angles.zw += deltaZW;
    this.updateGeometry();
  }

  /** Set an absolute angle instead of nudging it - useful for UI sliders. */
  public setRotation(plane: RotationPlane, radians: number): void {
    this.angles[plane] = radians;
    this.updateGeometry();
  }

  public getRotation(plane: RotationPlane): number {
    return this.angles[plane];
  }

  /** The current 9 corners, already rotated and projected into 3D. */
  public getProjectedVertices(): THREE.Vector3[] {
    return this.baseVertices
      .map((v) => HyperPyramid.rotatePoint(v, "xw", this.angles.xw))
      .map((v) => HyperPyramid.rotatePoint(v, "yw", this.angles.yw))
      .map((v) => HyperPyramid.rotatePoint(v, "zw", this.angles.zw))
      .map((v) => this.project(v));
  }

  /** Free the GPU resources when you remove this from your scene. */
  public dispose(): void {
    this.lineGeometry.dispose();
    this.lineMaterial.dispose();
    this.baseFaceGeometry.dispose();
    this.baseFaceMaterial.dispose();
  }

  // ── internals ────────────────────────────────────────────────────────

  /** Rotate a single 4D point by `angle` radians in one plane. Pure
   *  function - returns a new point, never mutates the one passed in. */
  private static rotatePoint(
    p: Vec4,
    plane: RotationPlane,
    angle: number,
  ): Vec4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    switch (plane) {
      case "xw":
        return { x: p.x * c - p.w * s, y: p.y, z: p.z, w: p.x * s + p.w * c };
      case "yw":
        return { x: p.x, y: p.y * c - p.w * s, z: p.z, w: p.y * s + p.w * c };
      case "zw":
        return { x: p.x, y: p.y, z: p.z * c - p.w * s, w: p.z * s + p.w * c };
    }
  }

  /** Perspective-project a 4D point to 3D by dividing by its distance
   *  from the 4D "camera" along w - exactly like a 3D camera divides by
   *  distance along z. Points with larger w end up bigger/closer. */
  private project(p: Vec4): THREE.Vector3 {
    const scale = this.projectionDistance / (this.projectionDistance - p.w);
    return new THREE.Vector3(p.x * scale, p.y * scale, p.z * scale);
  }

  /** Recompute rotated + projected corners and write them into both
   *  geometries. Called automatically after every rotation change. */
  private updateGeometry(): void {
    // Always rotate the ORIGINAL corners, not the previously-rotated
    // ones - that way angles never drift or compound rounding error.
    const rotated = this.baseVertices.map((v) => {
      let p = HyperPyramid.rotatePoint(v, "xw", this.angles.xw);
      p = HyperPyramid.rotatePoint(p, "yw", this.angles.yw);
      p = HyperPyramid.rotatePoint(p, "zw", this.angles.zw);
      return p;
    });
    const projected = rotated.map((p) => this.project(p));

    // Write the 20 edges.
    const linePositions = this.lineGeometry.attributes
      .position as THREE.BufferAttribute;
    this.edgeIndices.forEach(([a, b], i) => {
      linePositions.setXYZ(
        i * 2,
        projected[a].x,
        projected[a].y,
        projected[a].z,
      );
      linePositions.setXYZ(
        i * 2 + 1,
        projected[b].x,
        projected[b].y,
        projected[b].z,
      );
    });
    linePositions.needsUpdate = true;

    // Write the base cube's 6 faces (2 triangles each).
    const facePositions = this.baseFaceGeometry.attributes
      .position as THREE.BufferAttribute;
    let v = 0;
    for (const face of this.baseFaces) {
      const [i0, i1, i2, i3] = face;
      const p0 = projected[i0],
        p1 = projected[i1],
        p2 = projected[i2],
        p3 = projected[i3];
      facePositions.setXYZ(v++, p0.x, p0.y, p0.z);
      facePositions.setXYZ(v++, p1.x, p1.y, p1.z);
      facePositions.setXYZ(v++, p2.x, p2.y, p2.z);
      facePositions.setXYZ(v++, p0.x, p0.y, p0.z);
      facePositions.setXYZ(v++, p2.x, p2.y, p2.z);
      facePositions.setXYZ(v++, p3.x, p3.y, p3.z);
    }
    facePositions.needsUpdate = true;
    this.baseFaceGeometry.computeVertexNormals();
  }
}
