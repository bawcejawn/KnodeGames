// Audit AB-058: makes the key the publish jobs seal the vault results files with. Run once, on the owner's PC:
//
//   node tools/results-seal-key.mjs
//
// It writes the PRIVATE key to a file in your home folder (never in the repository), and prints the PUBLIC key.
//   1. Open that file, copy all of it, and paste it into GitHub → Settings → Secrets and variables → Actions →
//      New repository secret, named RESULTS_SEAL_KEY. Then delete the file.
//   2. Give the PUBLIC key (one line) to the chat: it goes into game-data/deployment.json as "resultsSealKey".
// The private key is never printed and never needed again: if it is lost or leaked, run this again and replace both.
// docs/ops/RESULTS-SEAL.md has the whole procedure.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";

const out = path.join(os.homedir(), "knodegames-results-seal-key.txt");
if (fs.existsSync(out)) {
  console.error(`${out} already exists. If you already put it in GitHub, delete it and run this again only to replace the key.`);
  process.exit(1);
}
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
fs.writeFileSync(out, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
const pub = publicKey.export({ type: "spki", format: "der" }).toString("base64");
console.log(`Private key written to: ${out}`);
console.log("  → paste ALL of that file into a new repository secret named RESULTS_SEAL_KEY, then delete the file.");
console.log("");
console.log(`Public key (safe to share; give this line to the chat): ${pub}`);
