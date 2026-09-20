import { Suspense } from "react";

import {
  effectiveLight,
  lightToShade,
} from "../world/lighting";

import type {
  Direction,
  PlayerGridPosition,
  World,
} from "../world/types";

import { LandmarkRenderer } from "./LandmarkRenderer";
import { TerrainMesh } from "./TerrainMesh";
import { useShadeMaterials } from "./materials";

/*
 * Convert the direction stored on a stair cell into the
 * rotation used by the stair geometry.
 */
function stairRotation(
  direction?: Direction
): number {
  if (direction === "east") {
    return -Math.PI / 2;
  }

  if (direction === "south") {
    return Math.PI;
  }

  if (direction === "west") {
    return Math.PI / 2;
  }

  return 0;
}

interface WorldRendererProps {
  world: World;
  player: PlayerGridPosition;
  lanternOn: boolean;
}

export function WorldRenderer({
  world,
  player,
  lanternOn,
}: WorldRendererProps) {
  const {
    materials,
    materialForShade,
  } = useShadeMaterials();

  return (
    <>
      {/*
       * V6.1 TERRAIN
       *
       * TerrainMesh replaces the individual floor boxes.
       * It renders one connected terrain surface using the
       * elevation data already stored on each cell.
       */}
      <TerrainMesh
        world={world}
        player={player}
        lanternOn={lanternOn}
        materials={materials}
        materialForShade={materialForShade}
      />

      {/*
       * Render all non-terrain world objects.
       *
       * Floor, spawn, landmark, and light cells already receive
       * their ground surface from TerrainMesh.
       */}
      {world.cells.map((cell) => {
        const lightLevel = effectiveLight(
          cell,
          player,
          lanternOn,
          world.solidCells
        );

        const shade = lightToShade(lightLevel);

        const material =
          materialForShade(shade);

        /*
         * WALLS
         *
         * Walls continue to use their cell elevation as the
         * elevation of the bottom of the wall.
         */
        if (cell.type === "wall") {
          return (
            <mesh
              key={cell.id}
              material={material}
              position={[
                cell.x,
                cell.y +
                  cell.wallHeight / 2,
                cell.z,
              ]}
            >
              <boxGeometry
                args={[
                  world.cellSize,
                  cell.wallHeight,
                  world.cellSize,
                ]}
              />
            </mesh>
          );
        }

        /*
         * STAIRS
         *
         * Stair geometry remains independent from TerrainMesh.
         * The bottom of each staircase begins at cell.y.
         */
        if (cell.type === "stairs") {
          const stepCount = 12;
          const stepHeight =
            cell.wallHeight / stepCount;
          const stepDepth =
            world.cellSize / stepCount;

          return (
            <group
              key={cell.id}
              position={[
                cell.x,
                cell.y,
                cell.z,
              ]}
              rotation={[
                0,
                stairRotation(
                  cell.direction
                ),
                0,
              ]}
            >
              {Array.from(
                { length: stepCount },
                (_, index) => {
                  const stepY =
                    (index + 0.5) *
                    stepHeight;

                  const stepZ =
                    -world.cellSize / 2 +
                    (index + 0.5) *
                      stepDepth;

                  return (
                    <mesh
                      key={index}
                      material={material}
                      position={[
                        0,
                        stepY,
                        stepZ,
                      ]}
                    >
                      <boxGeometry
                        args={[
                          world.cellSize,
                          stepHeight,
                          stepDepth,
                        ]}
                      />
                    </mesh>
                  );
                }
              )}
            </group>
          );
        }

        /*
         * LANDMARKS
         *
         * TerrainMesh provides the ground beneath this cell.
         * The landmark group begins at the cell's terrain-aware
         * position.
         */
        if (cell.type === "landmark") {
          return (
            <group
              key={cell.id}
              userData={{
                landmark: cell.landmark,
              }}
            >
              <group
                position={[
                  cell.x,
                  cell.y,
                  cell.z,
                ]}
              >
                <Suspense fallback={null}>
                  <LandmarkRenderer
                    cell={cell}
                    world={world}
                    player={player}
                    lanternOn={lanternOn}
                    materialForShade={
                      materialForShade
                    }
                  />
                </Suspense>
              </group>
            </group>
          );
        }

        /*
         * FIXED LIGHT MARKERS
         *
         * TerrainMesh provides the ground underneath the light.
         * This sphere is only the visible marker for the light.
         */
        if (cell.type === "light") {
          const brightestMaterial =
            materials[
              materials.length - 1
            ];

          return (
            <mesh
              key={cell.id}
              material={brightestMaterial}
              position={[
                cell.x,
                cell.y + 1.2,
                cell.z,
              ]}
            >
              <sphereGeometry
                args={[0.12, 8, 8]}
              />
            </mesh>
          );
        }

        /*
         * FLOOR AND SPAWN CELLS
         *
         * These no longer need individual geometry because
         * TerrainMesh renders their connected ground surface.
         */
        return null;
      })}
    </>
  );
}