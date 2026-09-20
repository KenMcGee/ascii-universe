import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SETTINGS } from "../config/settings";
export function useShadeMaterials() {
  const materials = useMemo(
    () =>
      Array.from({ length: Math.max(2, SETTINGS.brightnessSteps) }, (_, i) => {
        const shade = i / (Math.max(2, SETTINGS.brightnessSteps) - 1);
        return new THREE.MeshBasicMaterial({
          color: new THREE.Color(shade, shade, shade),
        });
      }),
    [],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  return {
    materials,
    materialForShade: (shade: number) =>
      materials[
        Math.max(
          0,
          Math.min(
            materials.length - 1,
            Math.round(shade * (materials.length - 1)),
          ),
        )
      ],
  };
}
