import * as THREE from "three";
import type { FourDFigure } from "./iFourDFigure";
import type { Vec4 } from "./iFourDFigure";
import type { RotationPlane } from "./iFourDFigure";

/** Resolution of the hypersphere's grid: how many samples to take along
 *  each of the three angles that parametrize a 3-sphere. Higher values
 *  give a rounder result at the cost of more vertices/edges - counts
 *  grow roughly as theta * phi * psi, so raise these gradually. */
export interface HyperSphereSegments {
  /** Longitude-like angle, sweeping a full 0 to 2*pi circle within each
   *  shell. */
  theta: number;
  /** Colatitude-like angle, sweeping pole-to-pole (0 to pi) within each
   *  shell. */
  phi: number;
  /** "Hyper-latitude" angle, sweeping pole-to-pole (0 to pi) along W,
   *  choosing which shell. */
  psi: number;
}

/**
 * A 4D hypersphere (mathematically, a "3-sphere" or "glome"): every
 * point sits at a fixed distance `radius` from the origin in 4D. It's
 * built the way an ordinary 2D sphere is often built for 3D graphics -
 * marching two angles (theta, phi) over a grid - except a 3-sphere
 * needs a third angle (psi) to sweep through a whole family of
 * ordinary 2-spheres, one per W "shell": a single point at w = +radius,
 * growing to a full-size 2-sphere at the equator (w = 0), then
 * shrinking back to a point at w = -radius.
 */
export class HyperSphere implements FourDFigure {
  /** Add this to your scene: `scene.add(hyperSphere.group)`. */
  public readonly group: THREE.Group;

  /** How far the 4D "camera" sits along W. Must exceed `radius` - every
   *  vertex sits exactly `radius` from the origin, so that's the hard
   *  ceiling on how large |w| can get after any rotation. */
  public projectionDistance: number;

  // Every grid point on the 3-sphere, in original un-rotated 4D
  // positions. Indexed by (shell si, latitude pi, longitude ti) via the
  // `index` helper built in the constructor.
  private readonly baseVertices: Vec4[];

  // The rotation currently applied in each plane, in radians.
  private angles: { xw: number; yw: number; zw: number } = {
    xw: 0,
    yw: 0,
    zw: 0,
  };

  // Pairs of vertex indices connected by an edge: theta-neighbors and
  // phi-neighbors within a shell, plus psi-neighbors between shells.
  private readonly edgeIndices: [number, number][];

  // Triangulated quads of the single "equatorial" shell (the shell at
  // the middle psi value, i.e. w nearest 0) - the biggest
  // cross-section, playing the same role the inner cube plays for the
  // Tesseract.
  private readonly equatorFaces: [number, number, number, number][] = [];

  private lineGeometry: THREE.BufferGeometry;
  private lineMaterial: THREE.LineBasicMaterial;
  private equatorGeometry: THREE.BufferGeometry;
  private equatorMaterial: THREE.MeshBasicMaterial;
  private equatorMesh: THREE.Mesh;

  /**
   * @param radius Distance of every point from the origin, in 4D.
   *   Defaults to 1.
   * @param segments Grid resolution - see `HyperSphereSegments`.
   *   Defaults to { theta: 16, phi: 8, psi: 8 }.
   * @param projectionDistance Distance of the 4D "camera" along W. Must
   *   be greater than `radius` (rotation can never push a vertex's |w|
   *   past its fixed distance from the origin). Left undefined, a safe
   *   default (1.5x radius) is used.
   */
  constructor(
    radius = 1,
    segments: HyperSphereSegments = { theta: 16, phi: 8, psi: 8 },
    projectionDistance?: number,
  ) {
    this.group = new THREE.Group();
    this.projectionDistance = projectionDistance ?? radius * 1.5;

    const { theta: thetaSeg, phi: phiSeg, psi: psiSeg } = segments;

    // Build the grid: for every "shell" si (position along W), every
    // "latitude" pi within that shell, every "longitude" ti around
    // that latitude - the standard hyperspherical-coordinates formula.
    this.baseVertices = [];
    for (let si = 0; si <= psiSeg; si++) {
      const psiAngle = (si / psiSeg) * Math.PI;
      const sinPsi = Math.sin(psiAngle);
      for (let pi = 0; pi <= phiSeg; pi++) {
        const phiAngle = (pi / phiSeg) * Math.PI;
        for (let ti = 0; ti < thetaSeg; ti++) {
          const thetaAngle = (ti / thetaSeg) * 2 * Math.PI;
          this.baseVertices.push({
            x: radius * sinPsi * Math.sin(phiAngle) * Math.cos(thetaAngle),
            y: radius * sinPsi * Math.sin(phiAngle) * Math.sin(thetaAngle),
            z: radius * sinPsi * Math.cos(phiAngle),
            w: radius * Math.cos(psiAngle),
          });
        }
      }
    }

    const index = (si: number, pi: number, ti: number): number =>
      si * (phiSeg + 1) * thetaSeg + pi * thetaSeg + ti;

    // Build the edges: theta-neighbors (wrapping around each latitude
    // ring, skipped at the two shell poles where they'd be
    // zero-length), phi-neighbors (pole-to-pole within a shell), and
    // psi-neighbors (between corresponding points on adjacent shells).
    this.edgeIndices = [];
    for (let si = 0; si <= psiSeg; si++) {
      for (let pi = 0; pi <= phiSeg; pi++) {
        if (pi !== 0 && pi !== phiSeg) {
          for (let ti = 0; ti < thetaSeg; ti++) {
            this.edgeIndices.push([
              index(si, pi, ti),
              index(si, pi, (ti + 1) % thetaSeg),
            ]);
          }
        }
        if (pi < phiSeg) {
          for (let ti = 0; ti < thetaSeg; ti++) {
            this.edgeIndices.push([index(si, pi, ti), index(si, pi + 1, ti)]);
          }
        }
      }
      if (si < psiSeg) {
        for (let pi = 0; pi <= phiSeg; pi++) {
          for (let ti = 0; ti < thetaSeg; ti++) {
            this.edgeIndices.push([index(si, pi, ti), index(si + 1, pi, ti)]);
          }
        }
      }
    }

    // Build the equatorial shell's faces - a standard UV-sphere quad
    // grid at the middle psi ring, split into 2 triangles each.
    const equatorSi = Math.floor(psiSeg / 2);
    for (let pi = 0; pi < phiSeg; pi++) {
      for (let ti = 0; ti < thetaSeg; ti++) {
        const tiNext = (ti + 1) % thetaSeg;
        this.equatorFaces.push([
          index(equatorSi, pi, ti),
          index(equatorSi, pi + 1, ti),
          index(equatorSi, pi + 1, tiNext),
          index(equatorSi, pi, tiNext),
        ]);
      }
    }

    // --- wireframe: every edge, as one LineSegments object ---
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

    // --- equatorial shell: transparent light blue ---
    this.equatorGeometry = new THREE.BufferGeometry();
    this.equatorGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(this.equatorFaces.length * 6 * 3),
        3,
      ),
    );
    this.equatorMaterial = new THREE.MeshBasicMaterial({
      color: 0x87cefa, // light sky blue
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide, // visible from inside AND outside
      depthWrite: false, // avoids see-through sorting glitches
    });
    this.equatorMesh = new THREE.Mesh(
      this.equatorGeometry,
      this.equatorMaterial,
    );
    this.group.add(this.equatorMesh);

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

  /** The current grid points, already rotated and projected into 3D. */
  public getProjectedVertices(): THREE.Vector3[] {
    return this.baseVertices
      .map((v) => HyperSphere.rotatePoint(v, "xw", this.angles.xw))
      .map((v) => HyperSphere.rotatePoint(v, "yw", this.angles.yw))
      .map((v) => HyperSphere.rotatePoint(v, "zw", this.angles.zw))
      .map((v) => this.project(v));
  }

  /** Free the GPU resources when you remove this from your scene. */
  public dispose(): void {
    this.lineGeometry.dispose();
    this.lineMaterial.dispose();
    this.equatorGeometry.dispose();
    this.equatorMaterial.dispose();
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

  /** Recompute rotated + projected grid points and write them into both
   *  geometries. Called automatically after every rotation change. */
  private updateGeometry(): void {
    // Always rotate the ORIGINAL points, not the previously-rotated
    // ones - that way angles never drift or compound rounding error.
    const rotated = this.baseVertices.map((v) => {
      let p = HyperSphere.rotatePoint(v, "xw", this.angles.xw);
      p = HyperSphere.rotatePoint(p, "yw", this.angles.yw);
      p = HyperSphere.rotatePoint(p, "zw", this.angles.zw);
      return p;
    });
    const projected = rotated.map((p) => this.project(p));

    // Write every edge.
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

    // Write the equatorial shell's faces (2 triangles per quad).
    const facePositions = this.equatorGeometry.attributes
      .position as THREE.BufferAttribute;
    let v = 0;
    for (const face of this.equatorFaces) {
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
    this.equatorGeometry.computeVertexNormals();
  }
}
