import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(repositoryRoot, "src", "decision-cockpit");
const outputRoot = path.join(repositoryRoot, "dist", "decision-cockpit");

async function filesRecursively(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesRecursively(resolved));
    else files.push(resolved);
  }
  return files;
}

const htmlSource = await readFile(path.join(repositoryRoot, "decision-cockpit.html"), "utf8");
const requiredLabels = ["LIVE MARKET", "PREMARKET", "GLOBAL FLOW", "MODEL TEST"];
for (const label of requiredLabels) {
  if (!htmlSource.includes(label)) throw new Error(`Static shell is missing required navigation label: ${label}`);
}

const moduleFiles = await filesRecursively(sourceRoot);
for (const file of moduleFiles.filter((item) => item.endsWith(".js"))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Syntax check failed for ${path.relative(repositoryRoot, file)}\n${result.stderr}`);
}

const shellFiles = [path.join(repositoryRoot, "decision-cockpit.html"), ...moduleFiles]
  .filter((file) => /\.(?:html|js|css)$/.test(file));
for (const file of shellFiles) {
  const source = await readFile(file, "utf8");
  if (/https?:\/\//i.test(source)) throw new Error(`External network URL is not allowed in the mock shell: ${path.relative(repositoryRoot, file)}`);
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(path.join(outputRoot, "src"), { recursive: true });
await writeFile(path.join(outputRoot, "index.html"), htmlSource, "utf8");
await cp(sourceRoot, path.join(outputRoot, "src", "decision-cockpit"), { recursive: true });

console.log(`Static Decision Cockpit build PASS: ${path.relative(repositoryRoot, outputRoot)}`);

