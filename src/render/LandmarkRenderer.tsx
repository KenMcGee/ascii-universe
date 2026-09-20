import { useGLTF } from "@react-three/drei";
import {
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";

import {
  effectiveLightAtPosition,
  lightToShade,
} from "../world/lighting";

import type {
  Cell,
  PlayerGridPosition,
  World,
} from "../world/types";

interface LandmarkRendererProps {
  cell: Cell;
  world: World;
  player: PlayerGridPosition;
  lanternOn: boolean;

  materialForShade: (
    shade: number,
  ) => THREE.MeshBasicMaterial;
}

export function LandmarkRenderer({
  cell,
  world,
  player,
  lanternOn,
  materialForShade,
}: LandmarkRendererProps) {
  const landmark = cell.landmark;

  // Display fallback geometry when no GLB has been assigned.
  if (!landmark?.model) {
    return (
      <mesh
        position={[0, 0.75, 0]}
        material={materialForShade(
          lightToShade(cell.staticLight),
        )}
      >
        <octahedronGeometry args={[0.65]} />
      </mesh>
    );
  }

  return (
    <ImportedLandmark
      url={landmark.model}
      scale={landmark.scale ?? 1}
      rotation={landmark.rotation ?? [0, 0, 0]}
      offset={landmark.offset ?? [0, 0, 0]}
      world={world}
      player={player}
      lanternOn={lanternOn}
      materialForShade={materialForShade}
    />
  );
}

interface ImportedLandmarkProps {
  url: string;

  scale:
    | number
    | [number, number, number];

  rotation: [
    number,
    number,
    number,
  ];

  offset: [
    number,
    number,
    number,
  ];

  world: World;
  player: PlayerGridPosition;
  lanternOn: boolean;

  materialForShade: (
    shade: number,
  ) => THREE.MeshBasicMaterial;
}

function ImportedLandmark({
  url,
  scale,
  rotation,
  offset,
  world,
  player,
  lanternOn,
  materialForShade,
}: ImportedLandmarkProps) {
  const gltf = useGLTF(url);

  // This ref points to the transformed group that contains the GLB.
  // Its parent is the map-cell placement group in WorldRenderer.
  const landmarkGroup = useRef<THREE.Group>(null);

  // Each placed landmark receives its own object hierarchy.
  const clonedScene = useMemo(() => {
    return gltf.scene.clone(true);
  }, [gltf.scene]);

  useLayoutEffect(() => {
    const group = landmarkGroup.current;

    if (!group) {
      return;
    }

    // Critical step:
    //
    // This updates:
    // 1. Map-cell placement
    // 2. Landmark offset
    // 3. Landmark rotation
    // 4. Landmark scale
    // 5. Nested GLB node transformations
    group.updateWorldMatrix(true, true);

    const meshBounds = new THREE.Box3();
    const meshCenter = new THREE.Vector3();

    clonedScene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      // setFromObject() now sees the object's final world transform.
      meshBounds.setFromObject(object, true);

      if (meshBounds.isEmpty()) {
        return;
      }

      meshBounds.getCenter(meshCenter);

      // Convert the transformed world-space center to map-grid coordinates.
      const gx = Math.round(
        meshCenter.x / world.cellSize,
      );

      const gz = Math.round(
        meshCenter.z / world.cellSize,
      );

      // Sample fixed T lights and the player lantern at this mesh.
      const lightLevel =
        effectiveLightAtPosition(
          gx,
          gz,
          world,
          player,
          lanternOn,
        );

      const shade =
        lightToShade(lightLevel);

      object.material =
        materialForShade(shade);

      object.castShadow = false;
      object.receiveShadow = false;
    });
  }, [
    clonedScene,
    world,
    player.gx,
    player.gz,
    lanternOn,
    materialForShade,
  ]);

  return (
    <group
      ref={landmarkGroup}
      position={offset}
      rotation={rotation}
      scale={scale}
    >
      <primitive object={clonedScene} />
    </group>
  );
}
