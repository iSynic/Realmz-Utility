import fs from "node:fs/promises";
import path from "node:path";
import { analyzeScenario, discoverScenarios } from "../src/realmz-parser.mjs";

const REQUIRED_DOCS = [
  "docs/scenario-format/README.md",
  "docs/scenario-format/format-index.md",
  "docs/scenario-format/semantic-schema.md",
  "docs/scenario-format/evidence-map.md",
  "docs/scenario-format/fixtures.md",
];

const DEFAULT_FIXTURE_ROOTS = [
  "F:\\Realmz\\base\\Realmz\\Scenarios",
  "F:\\Realmz\\out_win_clang\\Scenarios",
  "F:\\Realmz\\out_win_clang\\bin\\Scenarios",
];

const PREFERRED_FIXTURES = [
  "City of Bywater",
  "Prelude to Pestilence",
  "War in the Sword Lands",
  "Mithril Vault",
  "Wrath of the Mind Lords",
];

async function exists(target) {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

function assertSchemaShape(analysis) {
  const schema = analysis.semanticSchema;
  if (!schema || schema.schemaVersion !== 1) {
    throw new Error(`${analysis.scenario.name}: missing semantic schema v1`);
  }
  for (const key of ["sources", "records", "entities", "links", "evidence", "diagnostics"]) {
    if (!Array.isArray(schema[key])) {
      throw new Error(`${analysis.scenario.name}: schema.${key} is not an array`);
    }
  }
  if (!schema.sources.some((source) => source.exists)) {
    throw new Error(`${analysis.scenario.name}: schema has no existing file sources`);
  }
  if (!schema.entities.some((entity) => entity.type === "map")) {
    throw new Error(`${analysis.scenario.name}: schema has no map entities`);
  }
  if (analysis.counts.actions > 0 && schema.links.length === 0) {
    throw new Error(`${analysis.scenario.name}: actions exist but no semantic links were emitted`);
  }
}

async function gatherFixtures() {
  const roots = [];
  for (const root of DEFAULT_FIXTURE_ROOTS) {
    if (await exists(root)) {
      roots.push(root);
    }
  }
  const byName = new Map();
  for (const root of roots) {
    for (const scenario of await discoverScenarios(root)) {
      if (!byName.has(scenario.name)) {
        byName.set(scenario.name, scenario.path);
      }
    }
  }
  const selected = PREFERRED_FIXTURES
    .filter((name) => byName.has(name))
    .map((name) => ({ name, path: byName.get(name) }));
  if (!selected.length && byName.size) {
    const [name, scenarioPath] = byName.entries().next().value;
    selected.push({ name, path: scenarioPath });
  }
  return selected;
}

async function main() {
  const errors = [];
  for (const doc of REQUIRED_DOCS) {
    if (!(await exists(path.resolve(doc)))) {
      errors.push(`Missing required doc: ${doc}`);
    }
  }

  const fixtures = await gatherFixtures();
  if (!fixtures.length) {
    console.warn("No fixture scenarios found under the default Realmz roots; schema fixture smoke checks were skipped.");
  }

  for (const fixture of fixtures) {
    try {
      const analysis = await analyzeScenario(fixture.path);
      assertSchemaShape(analysis);
      console.log(`ok ${fixture.name}: ${analysis.semanticSchema.summary.entityCount} entities, ${analysis.semanticSchema.summary.linkCount} links`);
    } catch (error) {
      errors.push(error?.stack || String(error));
    }
  }

  if (errors.length) {
    for (const error of errors) {
      console.error(error);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`Checked ${fixtures.length} scenario-format fixtures.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
