import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(moduleRoot, "../..");

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

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function checkLegacyIntegrity(errors) {
  const manifestPath = path.join(moduleRoot, "validation", "legacy-file-hashes.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const [relativePath, expected] of Object.entries(manifest)) {
    const content = await readFile(path.join(repositoryRoot, relativePath));
    const actual = sha256(content);
    if (actual !== expected) errors.push(`Legacy V5/control file changed: ${relativePath}`);
    if (content.toString("utf8").includes("decision-cockpit")) errors.push(`Legacy file depends on Decision Cockpit internals: ${relativePath}`);
  }
}

async function checkImportBoundaries(errors) {
  const engineFiles = (await filesRecursively(path.join(moduleRoot, "engines"))).filter((file) => file.endsWith(".js"));
  const uiFiles = (await filesRecursively(path.join(moduleRoot, "ui"))).filter((file) => file.endsWith(".js"));

  for (const file of engineFiles) {
    const source = await readFile(file, "utf8");
    if (/from\s+["'][^"']*adapters\//.test(source)) errors.push(`Engine imports provider adapter directly: ${path.relative(repositoryRoot, file)}`);
  }
  for (const file of uiFiles) {
    const source = await readFile(file, "utf8");
    if (/from\s+["'][^"']*adapters\//.test(source)) errors.push(`UI imports provider adapter directly: ${path.relative(repositoryRoot, file)}`);
    if (/\b(?:rawProviderPayload|vendorPayload|providerPayload)\b/.test(source)) errors.push(`UI references a provider raw payload type: ${path.relative(repositoryRoot, file)}`);
  }
}

async function checkNoNetworkInMockShell(errors) {
  const sourceFiles = await filesRecursively(moduleRoot);
  const shellFiles = [path.join(repositoryRoot, "decision-cockpit.html"), ...sourceFiles]
    .filter((file) => /\.(?:html|js|css)$/.test(file));
  for (const file of shellFiles) {
    const source = await readFile(file, "utf8");
    if (/https?:\/\//i.test(source)) errors.push(`Mock shell contains an external network URL: ${path.relative(repositoryRoot, file)}`);
  }
}

const errors = [];
await checkLegacyIntegrity(errors);
await checkImportBoundaries(errors);
await checkNoNetworkInMockShell(errors);

if (errors.length) {
  console.error(errors.map((error) => `ARCHITECTURE GUARD: ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Architecture guard PASS: legacy integrity, import boundaries, and mock-network isolation verified.");
}

