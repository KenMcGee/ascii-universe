import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SETTINGS } from "../config/settings";
import { findWalkableCell } from "../world/navigation";
import type { Cell, PlayerGridPosition, World } from "../world/types";
export function Player({
  world,
  onGridChange,
  onToggleLantern,
}: {
  world: World;
  onGridChange: (p: PlayerGridPosition) => void;
  onToggleLantern: () => void;
}) {
  const { camera } = useThree(),
    keys = useRef<Record<string, boolean>>({}),
    feetY = useRef(world.spawn[1] - SETTINGS.eyeHeight),
    active = useRef<Cell>(),
    lastGrid = useRef("");
  const forward = useMemo(() => new THREE.Vector3(), []),
    right = useMemo(() => new THREE.Vector3(), []),
    movement = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    camera.position.set(...world.spawn);
    const down = (e: KeyboardEvent) => {
      if (e.code === SETTINGS.lantern.toggleKey && !e.repeat) onToggleLantern();
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [camera, world, onToggleLantern]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    let f = 0,
      s = 0;
    if (keys.current.KeyW) f++;
    if (keys.current.KeyS) f--;
    if (keys.current.KeyD) s++;
    if (keys.current.KeyA) s--;
    if (f || s) {
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      right.crossVectors(forward, camera.up).normalize();
      movement
        .set(0, 0, 0)
        .addScaledVector(forward, f)
        .addScaledVector(right, s)
        .normalize()
        .multiplyScalar(SETTINGS.moveSpeed * dt);
      let result = findWalkableCell(
        world,
        camera.position.x + movement.x,
        camera.position.z,
        feetY.current,
        active.current,
      );
      if (result) {
        camera.position.x += movement.x;
        feetY.current = result.height;
        active.current = result.cell;
      }
      result = findWalkableCell(
        world,
        camera.position.x,
        camera.position.z + movement.z,
        feetY.current,
        active.current,
      );
      if (result) {
        camera.position.z += movement.z;
        feetY.current = result.height;
        active.current = result.cell;
      }
    }
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      feetY.current + SETTINGS.eyeHeight,
      16,
      dt,
    );
    const gx = Math.round(camera.position.x / world.cellSize),
      gz = Math.round(camera.position.z / world.cellSize),
      key = `${gx},${gz}`;
    if (key !== lastGrid.current) {
      lastGrid.current = key;
      onGridChange({ gx, gz });
    }
  });
  return null;
}
