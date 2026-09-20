import { cellKey } from "./lighting";
import type { Cell, World } from "./types";

export const MAX_TERRAIN_STEP = 0.35;

function stairHeight(
  cell: Cell,
  x: number,
  z: number,
  size: number
): number {
  let progress = 0;

  if (cell.direction === "north") {
    progress = 0.5 - (z - cell.z) / size;
  }

  if (cell.direction === "south") {
    progress = 0.5 + (z - cell.z) / size;
  }

  if (cell.direction === "east") {
    progress = 0.5 + (x - cell.x) / size;
  }

  if (cell.direction === "west") {
    progress = 0.5 - (x - cell.x) / size;
  }

  const clampedProgress = Math.max(
    0,
    Math.min(1, progress)
  );

  return (
    cell.elevation +
    clampedProgress * cell.wallHeight
  );
}

export function findWalkableCell(
  world: World,
  x: number,
  z: number,
  currentY: number,
  active?: Cell
) {
  const gx = Math.round(x / world.cellSize);
  const gz = Math.round(z / world.cellSize);

  const cells = world.cellsByPosition.get(
    cellKey(gx, gz)
  );

  if (!cells) return null;

  const samples = cells
    .filter((cell) => cell.walkable)
    .map((cell) => ({
      cell,
      height:
        cell.type === "stairs"
          ? stairHeight(
              cell,
              x,
              z,
              world.cellSize
            )
          : cell.elevation,
    }));

  const stair = samples.find(
    (sample) => sample.cell.type === "stairs"
  );

  if (stair) {
    return stair;
  }

  const currentGroundHeight =
    active?.elevation ?? currentY;

  const reachable = samples.filter((sample) => {
    const heightDifference = Math.abs(
      sample.height - currentGroundHeight
    );

    return heightDifference <= MAX_TERRAIN_STEP;
  });

  if (reachable.length === 0) {
    return null;
  }

  return reachable.reduce((best, item) => {
    const itemDifference = Math.abs(
      item.height - currentGroundHeight
    );

    const bestDifference = Math.abs(
      best.height - currentGroundHeight
    );

    return itemDifference < bestDifference
      ? item
      : best;
  });
}