import type { WorldFile } from "./types";
export async function loadWorld(url: string): Promise<WorldFile> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load world: ${response.status}`);
  return response.json();
}
