import { SETTINGS } from "../config/settings";
import type { Cell, LightingFile, PlayerGridPosition, World, } from "./types";
export const cellKey = (gx:number,gz:number) => `${gx},${gz}`;

// Bresenham grid ray for inexpensive wall occlusion.
function gridLine(x0:number,z0:number,x1:number,z1:number) {
  const cells:Array<[number,number]>=[]; let x=x0,z=z0;
  const dx=Math.abs(x1-x0), dz=Math.abs(z1-z0);
  const sx=x0<x1?1:-1, sz=z0<z1?1:-1; let error=dx-dz;
  while (x!==x1 || z!==z1) {
    const doubled=error*2;
    if (doubled>-dz) { error-=dz; x+=sx; }
    if (doubled<dx) { error+=dx; z+=sz; }
    cells.push([x,z]);
  }
  return cells;
}

function blocked(sourceX:number,sourceZ:number,targetX:number,targetZ:number,solid:Set<string>) {
  return gridLine(sourceX,sourceZ,targetX,targetZ).slice(0,-1).some(([x,z])=>solid.has(cellKey(x,z)));
}

function contribution(sourceX:number,sourceZ:number,targetX:number,targetZ:number,radius:number,intensity:number,occlude:boolean,solid:Set<string>) {
  const distance=Math.hypot(targetX-sourceX,targetZ-sourceZ);
  if (distance>radius) return 0;
  if (occlude && blocked(sourceX,sourceZ,targetX,targetZ,solid)) return 0;
  const falloff=1-distance/radius;
  return falloff*falloff*intensity;
}

export function calculateStaticLight(target:Cell, lights:Cell[], solid:Set<string>, settings:LightingFile) {
  let light=settings.ambient;
  for (const source of lights) {
    light += contribution(source.gx,source.gz,target.gx,target.gz,settings.radius,settings.intensity,settings.wallOcclusion,solid);
  }
  return Math.min(1,Math.max(0,light));
}

// Adds the moving lantern to the already baked fixed light.
export function effectiveLight(cell:Cell, player:PlayerGridPosition, lanternOn:boolean, solid:Set<string>) {
  let light=cell.staticLight;
  if (lanternOn) {
    light += contribution(player.gx,player.gz,cell.gx,cell.gz,SETTINGS.lantern.radius,SETTINGS.lantern.intensity,SETTINGS.lantern.wallOcclusion,solid);
  }
  return Math.min(1,Math.max(0,light));
}

// Samples the complete lighting system at any grid position.
//
// Unlike effectiveLight(), this does not require an existing map Cell.
// That makes it suitable for child meshes inside imported GLB models.
export function effectiveLightAtPosition(
  gx: number,
  gz: number,
  world: World,
  player: PlayerGridPosition,
  lanternOn: boolean,
) {
  let light = world.lighting.ambient;

  // Add every fixed T light.
  for (const source of world.fixedLights) {
    light += contribution(
      source.gx,
      source.gz,
      gx,
      gz,
      world.lighting.radius,
      world.lighting.intensity,
      world.lighting.wallOcclusion,
      world.solidCells,
    );
  }

  // Add the player-carried lantern.
  if (lanternOn) {
    light += contribution(
      player.gx,
      player.gz,
      gx,
      gz,
      SETTINGS.lantern.radius,
      SETTINGS.lantern.intensity,
      SETTINGS.lantern.wallOcclusion,
      world.solidCells,
    );
  }

  return Math.min(1, Math.max(0, light));
}

export function lightToShade(light:number) {
  const corrected=Math.pow(light,SETTINGS.brightnessGamma);
  const clamped=Math.max(SETTINGS.minimumBrightness,Math.min(SETTINGS.maximumBrightness,corrected));
  const last=Math.max(2,SETTINGS.brightnessSteps)-1;
  return Math.round(clamped*last)/last;
}
