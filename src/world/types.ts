export type Direction = "north" | "east" | "south" | "west";

export type CellType =
  | "wall"
  | "floor"
  | "spawn"
  | "stairs"
  | "landmark"
  | "light";

export interface MapLayerFile {
  id: string;
  elevation: number;
  wallHeight: number;

  // Gameplay data
  rows: string[];

  // Terrain data
  heightmap: string[];
}

export interface LightingFile {
  ambient: number;
  radius: number;
  intensity: number;
  wallOcclusion: boolean;
}

export interface LandmarkFile {
  symbol: string;
  id: string;
  title: string;
  description: string;
  model?: string;
  scale?: number | [number, number, number];
  rotation?: [number, number, number];
  offset?: [number, number, number];
}

export interface WorldFile {
  id: string;
  title: string;
  cellSize: number;
  lighting: LightingFile;
  layers: MapLayerFile[];
  landmarks: LandmarkFile[];
}

export interface Cell {
  id: string;

  // Grid coordinates
  gx: number;
  gz: number;

  // World coordinates
  x: number;
  y: number;
  z: number;

  type: CellType;
  walkable: boolean;

  // Height contributed by the heightmap
  terrainHeight: number;

  // Final height: layer elevation + terrain height
  elevation: number;

  wallHeight: number;
  staticLight: number;

  direction?: Direction;
  landmark?: LandmarkFile;
}

export interface World {
  cells: Cell[];
  cellsByPosition: Map<string, Cell[]>;
  fixedLights: Cell[];
  solidCells: Set<string>;
  spawn: [number, number, number];
  cellSize: number;
  lighting: LightingFile;
}

export interface PlayerGridPosition {
  gx: number;
  gz: number;
}