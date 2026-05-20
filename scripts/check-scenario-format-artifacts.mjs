import fs from "node:fs/promises";
import path from "node:path";
import { analyzeScenario, discoverScenarios } from "../src/realmz-parser.mjs";

const REQUIRED_DOCS = [
  "docs/scenario-format/README.md",
  "docs/scenario-format/format-index.md",
  "docs/scenario-format/semantic-schema.md",
  "docs/scenario-format/opcodes-edcd.md",
  "docs/scenario-format/source-anchors.md",
  "docs/scenario-format/runtime-consumer-matrix.md",
  "docs/scenario-format/byte-layout-reference.md",
  "docs/scenario-format/opcode-runtime-reference.md",
  "docs/scenario-format/resource-fork-taxonomy.md",
  "docs/scenario-format/containers/README.md",
  "docs/scenario-format/containers/action-records.md",
  "docs/scenario-format/containers/maps-random-and-fields.md",
  "docs/scenario-format/containers/encounters.md",
  "docs/scenario-format/containers/supporting-records.md",
  "docs/scenario-format/containers/assets-and-runtime-caches.md",
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
  for (const link of schema.links) {
    if (!Array.isArray(link.evidence) || !link.evidence.length) {
      throw new Error(`${analysis.scenario.name}: semantic link ${link.id} has no evidence`);
    }
  }
  for (const action of analysis.graph?.actions || []) {
    if ((action.category === "unknown" || String(action.label || "").startsWith("opcode ")) &&
        !schema.diagnostics.some((diagnostic) => diagnostic.type === "unknown-opcode" && diagnostic.data?.rawCode === action.rawCode)) {
      throw new Error(`${analysis.scenario.name}: unknown opcode ${action.rawCode} was not reported as a diagnostic`);
    }
    if (action.missingExtracode &&
        !schema.diagnostics.some((diagnostic) => diagnostic.type === "missing-edcd" && diagnostic.data?.edcdId === action.id)) {
      throw new Error(`${analysis.scenario.name}: missing EDCD row ${action.id} was not reported as a diagnostic`);
    }
  }
}

function hasLink(analysis, predicate) {
  return (analysis.semanticSchema?.links || []).some(predicate);
}

function assertFixtureSemantics(analysis) {
  const name = analysis.scenario.name;
  if (!hasLink(analysis, (link) => link.kind === "shows message" || String(link.kind).includes("message"))) {
    throw new Error(`${name}: expected at least one message semantic link`);
  }
  if ((analysis.records?.battles?.records || []).length && !hasLink(analysis, (link) => link.kind === "uses_monster")) {
    throw new Error(`${name}: expected battle to monster semantic links`);
  }
  if ((analysis.records?.monsters?.records || []).some((monster) => monster.iconId) &&
      !hasLink(analysis, (link) => link.kind === "uses_icon_resource")) {
    throw new Error(`${name}: expected monster icon resource links`);
  }
  if ((analysis.records?.monsters?.records || []).some((monster) => monster.iconId) &&
      !hasLink(analysis, (link) => link.kind === "uses_icon_resource" && link.to?.startsWith("resource:cicn:"))) {
    throw new Error(`${name}: expected monster icon links to target individual cicn resource references`);
  }
  if ((analysis.graph?.actions || []).some((action) => action.code === 27) &&
      !hasLink(analysis, (link) => link.kind === "shows picture" && link.to?.startsWith("resource:PICT:"))) {
    throw new Error(`${name}: expected show-picture actions to target individual PICT resource references`);
  }
  if ((analysis.records?.monsters?.records || []).some((monster) => monster.todoOnDeath) &&
      !hasLink(analysis, (link) => link.kind === "calls_death_macro")) {
    throw new Error(`${name}: expected monster death macro links`);
  }
  if (name === "City of Bywater") {
    if (!hasLink(analysis, (link) => String(link.kind).includes("battle"))) {
      throw new Error(`${name}: expected trigger/battle semantic links`);
    }
    if (!hasLink(analysis, (link) => link.to?.startsWith("map:") && (link.kind === "teleport target level" || link.kind === "describes_map"))) {
      throw new Error(`${name}: expected map target/describes-map links`);
    }
  }
  if (name === "Prelude to Pestilence") {
    if (!analysis.levels.some((level) => level.type === "dungeon" && level.renderKind === "dungeon-topdown" && level.renderPictureId === 302)) {
      throw new Error(`${name}: expected dungeon levels to document PICT 302 top-down rendering`);
    }
  }
  if (name === "War in the Sword Lands" || name === "Mithril Vault") {
    const cicn = analysis.resources?.catalog?.types?.find((entry) => entry.type === "cicn");
    if (!cicn || cicn.count < 1) {
      throw new Error(`${name}: expected custom cicn resource coverage`);
    }
    if (!analysis.semanticSchema?.entities?.some((entity) => entity.id.startsWith("resource:cicn:") && entity.type === "resource")) {
      throw new Error(`${name}: expected individual cicn resource entities`);
    }
  }
  const menuFile = analysis.files.find((file) => file.name === "Data MENU");
  if (menuFile?.exists && analysis.alignment?.menu?.full < 1) {
    throw new Error(`${name}: Data MENU exists but did not decode as at least one fixed record`);
  }
  if (name === "Wrath of the Mind Lords") {
    if ((analysis.semanticSchema?.summary?.linkCount || 0) < 1000) {
      throw new Error(`${name}: expected large-scenario semantic link coverage`);
    }
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
      assertFixtureSemantics(analysis);
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
