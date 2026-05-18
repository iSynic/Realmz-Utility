import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = path.resolve(import.meta.dirname, "..");
const runtimeDir = path.join(rootDir, "vendor", "runtime", "node");
const isWindows = process.platform === "win32";
const nodeTarget = isWindows
  ? path.join(runtimeDir, "node.exe")
  : path.join(runtimeDir, "bin", "node");

async function copyBundledNode() {
  if (!process.execPath) {
    throw new Error("Unable to resolve the current Node.js executable.");
  }

  await fs.rm(runtimeDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(nodeTarget), { recursive: true });
  await fs.copyFile(process.execPath, nodeTarget);

  if (!isWindows) {
    await fs.chmod(nodeTarget, 0o755);
  }

  await fs.writeFile(
    path.join(runtimeDir, "README.txt"),
    [
      "Bundled Node.js runtime for Realmz Scenario Utility.",
      `Prepared from: ${process.execPath}`,
      `Version: ${process.version}`,
      "This directory is generated during desktop packaging.",
      "",
    ].join("\n"),
  );
}

await copyBundledNode();
console.log(`Prepared bundled Node runtime at ${path.relative(rootDir, nodeTarget)}`);
