import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(process.cwd(), "..");
const sourceDir = path.join(projectRoot, "build", "wasm");
const targetDir = path.resolve(process.cwd(), "src", "wasm", "generated");

const artifacts = ["wheely_wasm.js", "wheely_wasm.wasm"];

if (!existsSync(sourceDir)) {
  console.error(
    "Missing build/wasm artifacts. Run `cmake --build . --target wheely_wasm` from the project root first."
  );
  process.exit(1);
}

await mkdir(targetDir, { recursive: true });

try {
  for (const artifact of artifacts) {
    const source = path.join(sourceDir, artifact);
    if (!existsSync(source)) {
      console.error(`Missing ${artifact} in ${sourceDir}. Build the WASM target before syncing.`);
      process.exit(1);
    }
    const destination = path.join(targetDir, artifact);
    await copyFile(source, destination);
  }
  console.log(`Copied WASM artifacts to ${path.relative(process.cwd(), targetDir)}.`);
} catch (error) {
  console.error("Failed to copy WASM artifacts:", error);
  process.exit(1);
}
