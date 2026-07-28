import * as THREE from "three" 

export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** The three rotation planes that involve the 4th axis (W). */
export type RotationPlane = "xw" | "yw" | "zw";


export interface FourDFigure {
    readonly group: THREE.Group;

    rotateOnPlane(radians: number, plane: RotationPlane): void;
    rotate(deltaXW: number, deltaYW: number, deltaZW: number): void;

    setRotation(plane: RotationPlane, radians: number): void;
    getRotation(plane: RotationPlane): number;

    getProjectedVertices(): THREE.Vector3[];

    dispose(): void;
}