import * as THREE from "three";


/** A point in 4D space. */
export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** The three rotation planes that involve the 4th axis (W). */
export type RotationPlane = "xw" | "yw" | "zw";

export class Tesseract {
  /** Add this to your scene: `scene.add(tesseract.group)`. */
  public readonly group: THREE.Group;

  /** How far the 4D "camera" sits along W. Must be > `size` or the
   *  projection can divide by zero (see note in the constructor). */
  public projectionDistance: number;

  // The 16 corners in their original, un-rotated 4D positions.
  private readonly baseVertices: Vec4[];

  // The rotation currently applied in each plane, in radians.
  private angles: { xw: number; yw: number; zw: number } = { xw: 0, yw: 0, zw: 0 };

  // Pairs of vertex indices that are connected by an edge (32 total).
  private readonly edgeIndices: [number, number][];

  // The 8 corners that make up the "inner cube" cell (w = -1).
  private readonly innerCubeVertexIndices = [0, 1, 2, 3, 4, 5, 6, 7];

  // The 6 faces of that cell, each written as 4 corner indices in
  // perimeter order (so they can be split into 2 triangles each).
  // These indices are LOCAL to innerCubeVertexIndices above.
  private readonly innerCubeFaces: [number, number, number, number][] = [
    [0, 1, 3, 2], // z = -1 face
    [4, 5, 7, 6], // z = +1 face
    [0, 1, 5, 4], // y = -1 face
    [2, 3, 7, 6], // y = +1 face
    [0, 2, 6, 4], // x = -1 face
    [1, 3, 7, 5], // x = +1 face
  ];

  private lineGeometry: THREE.BufferGeometry;
  private lineMaterial: THREE.LineBasicMaterial;
  private innerCubeGeometry: THREE.BufferGeometry;
  private innerCubeMaterial: THREE.MeshBasicMaterial;
  private innerCubeMesh: THREE.Mesh;

  /**
   * @param size How long one edge of the tesseract is, in 4D. Defaults to 2
   *   (corners at +-1 on every axis).
   * @param projectionDistance Distance of the 4D "camera" along W. Must be
   *   greater than `size` - a rotation can never push a corner's |w|
   *   past `size` (rotation preserves each corner's length), so anything
   *   bigger than that is always safe. Default of size * 1.5 has a
   *   comfortable safety margin.
   */
  constructor(size = 2, projectionDistance = size * 1.5) {
    this.projectionDistance = projectionDistance;
    this.group = new THREE.Group();

    // Build the 16 corners: every combination of +-half in x, y, z, w.
    const half = size / 2;
    this.baseVertices = [];
    for (let i = 0; i < 16; i++) {
      this.baseVertices.push({
        x: i & 1 ? half : -half,
        y: i & 2 ? half : -half,
        z: i & 4 ? half : -half,
        w: i & 8 ? half : -half,
      });
    }

    // Build the 32 edges: two corners are connected whenever their index
    // numbers differ in exactly one bit (i.e. exactly one coordinate flips).
    this.edgeIndices = [];
    for (let a = 0; a < 16; a++) {
      for (let b = a + 1; b < 16; b++) {
        const diff = a ^ b;
        const isSingleBit = diff !== 0 && (diff & (diff - 1)) === 0;
        if (isSingleBit) this.edgeIndices.push([a, b]);
      }
    }

    // --- wireframe: all 32 edges, as one LineSegments object ---
    this.lineGeometry = new THREE.BufferGeometry();
    this.lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this.edgeIndices.length * 2 * 3), 3)
    );
    this.lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const lineSegments = new THREE.LineSegments(this.lineGeometry, this.lineMaterial);
    this.group.add(lineSegments);

    // --- inner cube: 6 faces, transparent light green ---
    this.innerCubeGeometry = new THREE.BufferGeometry();
    this.innerCubeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this.innerCubeFaces.length * 6 * 3), 3)
    );
    this.innerCubeMaterial = new THREE.MeshBasicMaterial({
      color: 0x90ee90, // light green
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide, // visible from inside AND outside
      depthWrite: false, // avoids see-through sorting glitches
    });
    this.innerCubeMesh = new THREE.Mesh(this.innerCubeGeometry, this.innerCubeMaterial);
    this.group.add(this.innerCubeMesh);

    this.updateGeometry(); // draw the initial, un-rotated shape
  }


  // /** Rotate in the X-W plane by `radians`, added to the current angle. */


  public rotateOnPlane(radians: number, plain: RotationPlane): void {
      switch(plain) {
        case "xw":
          this.angles.xw += radians;
          break;
        case "yw":
          this.angles.yw += radians;
          break;
        case "zw":
          this.angles.zw += radians;
          break
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

  /** The current 16 corners, already rotated and projected into 3D -
   *  handy if you want to add your own markers/labels on the vertices. */
  public getProjectedVertices(): THREE.Vector3[] {
    return this.baseVertices
      .map((v) => Tesseract.rotatePoint(v, "xw", this.angles.xw))
      .map((v) => Tesseract.rotatePoint(v, "yw", this.angles.yw))
      .map((v) => Tesseract.rotatePoint(v, "zw", this.angles.zw))
      .map((v) => this.project(v));
  }

  /** Free the GPU resources when you remove this from your scene. */
  public dispose(): void {
    this.lineGeometry.dispose();
    this.lineMaterial.dispose();
    this.innerCubeGeometry.dispose();
    this.innerCubeMaterial.dispose();
  }

  // ── internals ────────────────────────────────────────────────────────

  /** Rotate a single 4D point by `angle` radians in one plane. Pure
   *  function - returns a new point, never mutates the one passed in. */
  private static rotatePoint(p: Vec4, plane: RotationPlane, angle: number): Vec4 {
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
      let p = Tesseract.rotatePoint(v, "xw", this.angles.xw);
      p = Tesseract.rotatePoint(p, "yw", this.angles.yw);
      p = Tesseract.rotatePoint(p, "zw", this.angles.zw);
      return p;
    });
    const projected = rotated.map((p) => this.project(p));

    // Write the 32 edges.
    const linePositions = this.lineGeometry.attributes.position as THREE.BufferAttribute;
    this.edgeIndices.forEach(([a, b], i) => {
      linePositions.setXYZ(i * 2, projected[a].x, projected[a].y, projected[a].z);
      linePositions.setXYZ(i * 2 + 1, projected[b].x, projected[b].y, projected[b].z);
    });
    linePositions.needsUpdate = true;

    // Write the inner cube's 6 faces (2 triangles each).
    const facePositions = this.innerCubeGeometry.attributes.position as THREE.BufferAttribute;
    let v = 0;
    for (const face of this.innerCubeFaces) {
      const [i0, i1, i2, i3] = face.map((local) => this.innerCubeVertexIndices[local]);
      const p0 = projected[i0], p1 = projected[i1], p2 = projected[i2], p3 = projected[i3];
      facePositions.setXYZ(v++, p0.x, p0.y, p0.z);
      facePositions.setXYZ(v++, p1.x, p1.y, p1.z);
      facePositions.setXYZ(v++, p2.x, p2.y, p2.z);
      facePositions.setXYZ(v++, p0.x, p0.y, p0.z);
      facePositions.setXYZ(v++, p2.x, p2.y, p2.z);
      facePositions.setXYZ(v++, p3.x, p3.y, p3.z);
    }
    facePositions.needsUpdate = true;
    this.innerCubeGeometry.computeVertexNormals();
  }
}
