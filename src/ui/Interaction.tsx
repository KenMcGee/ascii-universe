import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SETTINGS } from "../config/settings";
import type { LandmarkFile } from "../world/types";
export function Interaction({ onOpen }: { onOpen: (x: LandmarkFile) => void }) {
  const { camera, scene } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.code !== "KeyE") return;
      ray.setFromCamera(new THREE.Vector2(), camera);
      ray.far = SETTINGS.interactionDistance;
      for (const hit of ray.intersectObjects(scene.children, true)) {
        let object: THREE.Object3D | null = hit.object;
        while (object && !object.userData.landmark) object = object.parent;
        if (object?.userData.landmark) {
          onOpen(object.userData.landmark);
          return;
        }
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [camera, scene, ray, onOpen]);
  return null;
}
