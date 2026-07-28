// import * as THREE from "three" 
import type { FourDFigure } from "./iFourDFigure";
import type { RotationPlane } from "./iFourDFigure";

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

const sliders = {
xw: document.getElementById("xwSlider") as HTMLInputElement,
yw: document.getElementById("ywSlider") as HTMLInputElement,
zw: document.getElementById("zwSlider") as HTMLInputElement,
};

const readouts = {
xw: document.getElementById("xwValue")!,
yw: document.getElementById("ywValue")!,
zw: document.getElementById("zwValue")!,
};

const autoRotateBox = document.getElementById("autoRotate") as HTMLInputElement;
const resetBtn = document.getElementById("resetBtn") as HTMLInputElement;

// export function inputToRotation(figur: IFourDFigure) {
   

function setSlidersDisabled(disabled: boolean) {
  sliders.xw.disabled = disabled;
  sliders.yw.disabled = disabled;
  sliders.zw.disabled = disabled;
}

const planes: RotationPlane[] = ["xw", "yw", "zw"];

export function inputToRotation(figure: FourDFigure) {

    planes.forEach((plane) => {
        sliders[plane].addEventListener("input", () => {
            const degrees = Number(sliders[plane].value);
            readouts[plane].textContent = `${degrees}°`;
            figure.setRotation(plane, deg2rad(degrees));
        });
    });

    resetBtn.addEventListener("click", () => {
        planes.forEach((plane) => {
            sliders[plane].value = "0";
            readouts[plane].textContent = "0°";
            figure.setRotation(plane, 0);
        });
    });
    
    const autoSpeed = { xw: 0.006, yw: 0.004, zw: 0.005 };

      if (autoRotateBox.checked) {
        figure.rotate(autoSpeed.xw, autoSpeed.yw, autoSpeed.zw);
        planes.forEach((plane) => {
          const degrees = normalizeDegrees(Math.round(rad2deg(figure.getRotation(plane))));
          sliders[plane].value = `${degrees}°`;
          readouts[plane].textContent = `${degrees}°`;
        });
    }
    setSlidersDisabled(autoRotateBox.checked);
    autoRotateBox.addEventListener("change", () => setSlidersDisabled(autoRotateBox.checked));
    
    // ── Animation loop ───────────────────────────────────────────────────────

}

