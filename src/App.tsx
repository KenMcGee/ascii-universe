import { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AsciiRenderer, PointerLockControls } from "@react-three/drei";
import { SETTINGS } from "./config/settings";
import { Player } from "./player/Player";
import { WorldRenderer } from "./render/WorldRenderer";
import { Interaction } from "./ui/Interaction";
import { loadWorld } from "./world/loader";
import { parseWorld } from "./world/parser";
import type {
  LandmarkFile,
  PlayerGridPosition,
  WorldFile,
} from "./world/types";
function Scene({
  file,
  player,
  lanternOn,
  onGridChange,
  onToggleLantern,
  onOpen,
}: {
  file: WorldFile;
  player: PlayerGridPosition;
  lanternOn: boolean;
  onGridChange: (p: PlayerGridPosition) => void;
  onToggleLantern: () => void;
  onOpen: (x: LandmarkFile) => void;
}) {
  const world = useMemo(() => parseWorld(file), [file]);
  return (
    <>
      <color attach="background" args={[SETTINGS.sceneBackground]} />
      <fog
        attach="fog"
        args={[SETTINGS.fogColor, SETTINGS.fogNear, SETTINGS.fogFar]}
      />
      <WorldRenderer world={world} player={player} lanternOn={lanternOn} />
      <Player
        world={world}
        onGridChange={onGridChange}
        onToggleLantern={onToggleLantern}
      />
      <Interaction onOpen={onOpen} />
      <PointerLockControls selector="#enter-world" />
      <AsciiRenderer
        fgColor={SETTINGS.asciiForeground}
        bgColor={SETTINGS.sceneBackground}
        characters={SETTINGS.asciiCharacters}
        resolution={SETTINGS.asciiResolution}
        invert
      />
    </>
  );
}
export default function App() {
  const [file, setFile] = useState<WorldFile>(),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<LandmarkFile>(),
    [lanternOn, setLanternOn] = useState<boolean>(SETTINGS.lantern.startsOn),
    [player, setPlayer] = useState<PlayerGridPosition>({ gx: 0, gz: 0 });
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--page-background",
      SETTINGS.pageBackground,
    );
    loadWorld("/maps/world.json")
      .then(setFile)
      .catch((e) => setError(String(e)));
  }, []);
  const toggle = useCallback(() => setLanternOn((v) => !v), []);
  if (error) return <pre>{error}</pre>;
  if (!file) return <>Loading...</>;
  return (
    <main>
      <Canvas camera={{ position: [0, SETTINGS.eyeHeight, 0], fov: 68 }}>
        <Scene
          file={file}
          player={player}
          lanternOn={lanternOn}
          onGridChange={setPlayer}
          onToggleLantern={toggle}
          onOpen={setSelected}
        />
      </Canvas>
      <button id="enter-world">ENTER WORLD</button>
      <aside>
        WASD move
        <br />
        MOUSE look
        <br />E interact
        <br />L lantern: {lanternOn ? "ON" : "OFF"}
        <br />
        ESC release
      </aside>
      <div className="crosshair">+</div>
      {selected && (
        <section>
          <button onClick={() => setSelected(undefined)}>CLOSE</button>
          <h2>{selected.title}</h2>
          <p>{selected.description}</p>
        </section>
      )}
    </main>
  );
}
