// The kit's test fixture game (kit-example) as the tests load it: its module, its config and a repo-shaped root.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kitConfig, loadManifest } from "../../recorder/manifest.ts";
import { game } from "./games/kit-example/recorder.ts";

export const EXAMPLE_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const exampleGame = game;
export const exampleManifest = () => loadManifest("kit-example", EXAMPLE_ROOT);
export const exampleCfg = () => kitConfig(exampleManifest());
