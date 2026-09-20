import { SETTINGS } from "../config/settings";
import { calculateStaticLight, cellKey } from "./lighting";

import type {
  Cell,
  CellType,
  Direction,
  LandmarkFile,
  MapLayerFile,
  World,
  WorldFile,
} from "./types";

export const HEIGHT_STEP = 0.25;

const STAIRS: Record<string, Direction> = {
  "^": "north",
  ">": "east",
  "v": "south",
  "<": "west",
};

function classify(
  symbol: string,
  landmarks: Map<string, LandmarkFile>
): CellType | null {
  if (symbol === "#") return "wall";
  if (symbol === ".") return "floor";
  if (symbol === "@") return "spawn";
  if (symbol === "T") return "light";
  if (STAIRS[symbol]) return "stairs";
  if (landmarks.has(symbol)) return "landmark";

  return null;
}

export function terrainHeightAt(
  heightmap: string[],
  row: number,
  column: number
): number {
  const symbol = heightmap[row]?.[column] ?? "0";
  const value = Number(symbol);

  if (!Number.isFinite(value)) {
    throw new Error(
      `Invalid heightmap value "${symbol}" at row ${row}, column ${column}.`
    );
  }

  return value * HEIGHT_STEP;
}

function validateLayerHeightmap(layer: MapLayerFile): void {
  if (!Array.isArray(layer.heightmap)) {
    throw new Error(
      `Layer "${layer.id}" does not contain a heightmap array.`
    );
  }

  if (layer.heightmap.length !== layer.rows.length) {
    throw new Error(
      `Layer "${layer.id}" has ${layer.rows.length} gameplay rows, ` +
        `but ${layer.heightmap.length} heightmap rows.`
    );
  }

  layer.rows.forEach((row, rowIndex) => {
    const heightRow = layer.heightmap[rowIndex];

    if (heightRow.length !== row.length) {
      throw new Error(
        `Layer "${layer.id}", row ${rowIndex}: gameplay width is ` +
          `${row.length}, but heightmap width is ${heightRow.length}.`
      );
    }
  });
}

export function parseWorld(file: WorldFile): World {
  const cells: Cell[] = [];
  const cellsByPosition = new Map<string, Cell[]>();
  const fixedLights: Cell[] = [];
  const solidCells = new Set<string>();

  const landmarks = new Map<string, LandmarkFile>(
    file.landmarks.map((item) => [item.symbol, item])
  );

  const width = Math.max(
    ...file.layers.flatMap((layer) =>
      layer.rows.map((row) => row.length)
    )
  );

  const depth = Math.max(
    ...file.layers.map((layer) => layer.rows.length)
  );

  let spawn: [number, number, number] = [
    0,
    SETTINGS.eyeHeight,
    0,
  ];

  for (const layer of file.layers) {
    validateLayerHeightmap(layer);

    layer.rows.forEach((row, rowIndex) => {
      [...row.padEnd(width, " ")].forEach(
        (symbol, columnIndex) => {
          const type = classify(symbol, landmarks);

          if (!type) return;

          const gx = columnIndex - Math.floor(width / 2);
          const gz = rowIndex - Math.floor(depth / 2);

          const terrainHeight = terrainHeightAt(
            layer.heightmap,
            rowIndex,
            columnIndex
          );

          const elevation =
            layer.elevation + terrainHeight;

          const cell: Cell = {
            id: `${layer.id}-${columnIndex}-${rowIndex}`,

            gx,
            gz,

            x: gx * file.cellSize,
            y: elevation,
            z: gz * file.cellSize,

            type,
            walkable: type !== "wall",

            terrainHeight,
            elevation,

            wallHeight: layer.wallHeight,
            staticLight: 0,

            direction: STAIRS[symbol],
            landmark: landmarks.get(symbol),
          };

          cells.push(cell);

          const key = cellKey(gx, gz);
          const stack = cellsByPosition.get(key) ?? [];

          stack.push(cell);
          stack.sort((a, b) => a.elevation - b.elevation);

          cellsByPosition.set(key, stack);

          if (type === "wall") {
            solidCells.add(key);
          }

          if (type === "light") {
            fixedLights.push(cell);
          }

          if (type === "spawn") {
            spawn = [
              cell.x,
              cell.elevation + SETTINGS.eyeHeight,
              cell.z,
            ];
          }
        }
      );
    });
  }

  for (const cell of cells) {
    cell.staticLight = calculateStaticLight(
      cell,
      fixedLights,
      solidCells,
      file.lighting
    );
  }

  return {
    cells,
    cellsByPosition,
    fixedLights,
    solidCells,
    spawn,
    cellSize: file.cellSize,
    lighting: file.lighting,
  };
}