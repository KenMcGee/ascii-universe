import { useEffect, useMemo } from "react";
import * as THREE from "three";

import {
  effectiveLight,
  lightToShade,
} from "../world/lighting";

import type {
  Cell,
  PlayerGridPosition,
  World,
} from "../world/types";

interface TerrainMeshProps {
  world: World;
  player: PlayerGridPosition;
  lanternOn: boolean;

  materials: THREE.Material[];

  materialForShade: (
    shade: number
  ) => THREE.Material;
}

/*
 * These cell types receive terrain surfaces.
 *
 * Walls have their own geometry.
 * Stairs have their own geometry.
 */
function isTerrainCell(cell: Cell): boolean {
  return (
    cell.type === "floor" ||
    cell.type === "spawn" ||
    cell.type === "landmark" ||
    cell.type === "light"
  );
}

/*
 * Generate a consistent lookup key for one grid cell.
 */
function terrainCellKey(
  gx: number,
  gz: number
): string {
  return `${gx},${gz}`;
}

/*
 * Generate a key for one terrain vertex.
 *
 * Vertex coordinates use half-cell units:
 *
 * Cell center:
 *   ix = gx * 2
 *   iz = gz * 2
 *
 * Cell edges use odd coordinates.
 *
 * This allows neighboring cells to share the exact same
 * edge and corner vertices.
 */
function terrainVertexKey(
  ix: number,
  iz: number
): string {
  return `${ix},${iz}`;
}

export function TerrainMesh({
  world,
  player,
  lanternOn,
  materials,
  materialForShade,
}: TerrainMeshProps) {
  const geometry = useMemo(() => {
    const terrainCells =
      world.cells.filter(isTerrainCell);

    const terrainByPosition =
      new Map<string, Cell>();

    for (const cell of terrainCells) {
      terrainByPosition.set(
        terrainCellKey(cell.gx, cell.gz),
        cell
      );
    }

    /*
     * Shared vertex data.
     */
    const positions: number[] = [];

    const vertexIndices =
      new Map<string, number>();

    /*
     * Each bucket contains triangle indices assigned to
     * a specific ASCII shade material.
     */
    const materialBuckets: number[][] =
      materials.map(() => []);

    /*
     * Return a terrain cell if it exists at the requested
     * grid coordinate.
     */
    const getTerrainCell = (
      gx: number,
      gz: number
    ): Cell | undefined =>
      terrainByPosition.get(
        terrainCellKey(gx, gz)
      );

    /*
     * Calculate the elevation of a half-grid vertex.
     *
     * Center vertices use the exact cell elevation.
     *
     * Edge vertices average two neighboring cells.
     *
     * Corner vertices average up to four neighboring cells.
     */
    const calculateVertexHeight = (
      ix: number,
      iz: number,
      fallbackCell: Cell
    ): number => {
      const xIsCenter = ix % 2 === 0;
      const zIsCenter = iz % 2 === 0;

      /*
       * Exact center of one terrain cell.
       */
      if (xIsCenter && zIsCenter) {
        const centerCell = getTerrainCell(
          ix / 2,
          iz / 2
        );

        return (
          centerCell?.elevation ??
          fallbackCell.elevation
        );
      }

      const elevations: number[] = [];

      /*
       * East or west edge between two cells.
       */
      if (!xIsCenter && zIsCenter) {
        const leftGX = Math.floor(ix / 2);
        const rightGX = Math.ceil(ix / 2);
        const gz = iz / 2;

        const leftCell = getTerrainCell(
          leftGX,
          gz
        );

        const rightCell = getTerrainCell(
          rightGX,
          gz
        );

        if (leftCell) {
          elevations.push(
            leftCell.elevation
          );
        }

        if (rightCell) {
          elevations.push(
            rightCell.elevation
          );
        }
      }

      /*
       * North or south edge between two cells.
       */
      if (xIsCenter && !zIsCenter) {
        const gx = ix / 2;
        const northGZ = Math.floor(iz / 2);
        const southGZ = Math.ceil(iz / 2);

        const northCell = getTerrainCell(
          gx,
          northGZ
        );

        const southCell = getTerrainCell(
          gx,
          southGZ
        );

        if (northCell) {
          elevations.push(
            northCell.elevation
          );
        }

        if (southCell) {
          elevations.push(
            southCell.elevation
          );
        }
      }

      /*
       * Corner shared by up to four cells.
       */
      if (!xIsCenter && !zIsCenter) {
        const westGX = Math.floor(ix / 2);
        const eastGX = Math.ceil(ix / 2);

        const northGZ = Math.floor(iz / 2);
        const southGZ = Math.ceil(iz / 2);

        const cornerCells = [
          getTerrainCell(
            westGX,
            northGZ
          ),
          getTerrainCell(
            eastGX,
            northGZ
          ),
          getTerrainCell(
            eastGX,
            southGZ
          ),
          getTerrainCell(
            westGX,
            southGZ
          ),
        ];

        for (const cornerCell of cornerCells) {
          if (cornerCell) {
            elevations.push(
              cornerCell.elevation
            );
          }
        }
      }

      /*
       * At the edge of the map there may be only one
       * available terrain cell.
       */
      if (elevations.length === 0) {
        return fallbackCell.elevation;
      }

      const total = elevations.reduce(
        (sum, elevation) =>
          sum + elevation,
        0
      );

      return total / elevations.length;
    };

    /*
     * Create a vertex or return the existing shared vertex.
     */
    const getVertexIndex = (
      ix: number,
      iz: number,
      fallbackCell: Cell
    ): number => {
      const key = terrainVertexKey(
        ix,
        iz
      );

      const existingIndex =
        vertexIndices.get(key);

      if (existingIndex !== undefined) {
        return existingIndex;
      }

      const x =
        (ix / 2) * world.cellSize;

      const z =
        (iz / 2) * world.cellSize;

      const y = calculateVertexHeight(
        ix,
        iz,
        fallbackCell
      );

      const index = positions.length / 3;

      positions.push(x, y, z);
      vertexIndices.set(key, index);

      return index;
    };

    /*
     * Build a nine-vertex patch for each terrain cell:
     *
     * NW ----- N ----- NE
     *  |       |       |
     *  W ----- C ----- E
     *  |       |       |
     * SW ----- S ----- SE
     *
     * The outside points are shared between neighboring
     * cells. The center remains at the exact gameplay
     * elevation of the cell.
     */
    for (const cell of terrainCells) {
      const centerX = cell.gx * 2;
      const centerZ = cell.gz * 2;

      const center = getVertexIndex(
        centerX,
        centerZ,
        cell
      );

      const northWest = getVertexIndex(
        centerX - 1,
        centerZ - 1,
        cell
      );

      const north = getVertexIndex(
        centerX,
        centerZ - 1,
        cell
      );

      const northEast = getVertexIndex(
        centerX + 1,
        centerZ - 1,
        cell
      );

      const east = getVertexIndex(
        centerX + 1,
        centerZ,
        cell
      );

      const southEast = getVertexIndex(
        centerX + 1,
        centerZ + 1,
        cell
      );

      const south = getVertexIndex(
        centerX,
        centerZ + 1,
        cell
      );

      const southWest = getVertexIndex(
        centerX - 1,
        centerZ + 1,
        cell
      );

      const west = getVertexIndex(
        centerX - 1,
        centerZ,
        cell
      );

      /*
       * Clockwise perimeter when viewed from above.
       */
      const perimeter = [
        northWest,
        north,
        northEast,
        east,
        southEast,
        south,
        southWest,
        west,
      ];

      const cellMaterial =
        materialForShade(
          lightToShade(
            effectiveLight(
              cell,
              player,
              lanternOn,
              world.solidCells
            )
          )
        );

      let materialIndex =
        materials.indexOf(cellMaterial);

      /*
       * Fall back to the first material if a returned
       * material is not present in the materials array.
       */
      if (materialIndex < 0) {
        materialIndex = 0;
      }

      const indexBucket =
        materialBuckets[materialIndex];

      /*
       * Build eight triangles around the cell center.
       *
       * The order produces upward-facing polygons.
       */
      for (
        let index = 0;
        index < perimeter.length;
        index += 1
      ) {
        const current = perimeter[index];

        const next =
          perimeter[
            (index + 1) %
              perimeter.length
          ];

        indexBucket.push(
          center,
          next,
          current
        );
      }
    }

    const geometry =
      new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        positions,
        3
      )
    );

    /*
     * Combine the material buckets into one index array.
     * Each geometry group points to one shade material.
     */
    const combinedIndices: number[] = [];

    materialBuckets.forEach(
      (bucket, materialIndex) => {
        if (bucket.length === 0) {
          return;
        }

        const groupStart =
          combinedIndices.length;

        combinedIndices.push(...bucket);

        geometry.addGroup(
          groupStart,
          bucket.length,
          materialIndex
        );
      }
    );

    geometry.setIndex(combinedIndices);

    /*
     * Shared vertices allow normals to blend across cell
     * boundaries, creating smooth-looking terrain.
     */
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
  }, [
    world,
    player.gx,
    player.gz,
    lanternOn,
    materials,
    materialForShade,
  ]);

  /*
   * Dispose old geometry when the terrain or lantern
   * shading causes this geometry to be rebuilt.
   */
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (geometry.getAttribute("position").count === 0) {
    return null;
  }

  return (
    <mesh
      geometry={geometry}
      material={materials}
      receiveShadow
    />
  );
}