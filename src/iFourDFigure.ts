import * as THREE from "three" 

export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** The three rotation planes that involve the 4th axis (W). Exported as a
 *  runtime tuple as well as a type so callers can iterate the planes
 *  without repeating the list (and without it drifting out of sync). */
export const ROTATION_PLANES = ["xw", "yw", "zw"] as const;

export type RotationPlane = (typeof ROTATION_PLANES)[number];


export interface FourDFigure {
    readonly group: THREE.Group;

    rotateOnPlane(radians: number, plane: RotationPlane): void;
    rotate(deltaXW: number, deltaYW: number, deltaZW: number): void;

    setRotation(plane: RotationPlane, radians: number): void;
    getRotation(plane: RotationPlane): number;

    getProjectedVertices(): THREE.Vector3[];

    dispose(): void;
}