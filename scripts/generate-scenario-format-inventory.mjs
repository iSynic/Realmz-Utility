import fs from "node:fs/promises";
import path from "node:path";
import { analyzeScenario, discoverScenarios } from "../src/realmz-parser.mjs";

const DEFAULT_ROOTS = [
  "F:\\Realmz\\base\\Realmz\\Scenarios",
  "F:\\Realmz\\out_win_clang\\Scenarios",
  "F:\\Realmz\\out_win_clang\\bin\\Scenarios",
];

const DEFAULT_OUT_DIR = path.resolve("docs", "scenario-format", "generated");

async function exists(target) {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const roots = [];
  let outDir = DEFAULT_OUT_DIR;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      outDir = path.resolve(argv[index + 1] || DEFAULT_OUT_DIR);
      index += 1;
    } else if (arg.startsWith("--out=")) {
      outDir = path.resolve(arg.slice("--out=".length));
    } else {
      roots.push(path.resolve(arg));
    }
  }
  if (!roots.length && process.env.REALMZ_SCENARIO_ROOT) {
    roots.push(...process.env.REALMZ_SCENARIO_ROOT.split(path.delimiter).filter(Boolean).map((root) => path.resolve(root)));
  }
  if (!roots.length) {
    roots.push(...DEFAULT_ROOTS);
  }
  return { roots: [...new Set(roots)], outDir };
}

function increment(map, key, by = 1) {
  if (key == null || key === "") return;
  map.set(key, (map.get(key) || 0) + by);
}

function printableToken(value) {
  return String(value ?? "").replace(/[^\x20-\x7e]/g, (char) => `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

function sortedCounts(map, limit = 1000) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function summarizeAlignment(alignment) {
  const issues = [];
  for (const [name, info] of Object.entries(alignment || {})) {
    if (!info?.exists) continue;
    if (info.trailing || info.trailingBytes || info.partialRecords) {
      issues.push({
        name,
        fullRecords: info.fullRecords ?? info.full ?? null,
        trailing: info.trailing ?? info.trailingBytes ?? 0,
        partialRecords: info.partialRecords || 0,
        bytes: info.bytes || null,
      });
    }
  }
  return issues;
}

function summarizeScenario(analysis, root) {
  const opcodeCounts = new Map();
  const linkCounts = new Map();
  const resourceCounts = new Map();
  const fileSummaries = {};

  for (const file of analysis.files || []) {
    fileSummaries[file.name] = file.exists
      ? { bytes: file.bytes, sha256: file.sha256 }
      : { exists: false };
  }
  for (const action of analysis.graph?.actions || []) {
    increment(opcodeCounts, `${action.code}:${action.label}`);
  }
  for (const link of analysis.semanticSchema?.links || []) {
    increment(linkCounts, link.kind);
  }
  for (const resourceType of analysis.resources?.catalog?.types || []) {
    increment(resourceCounts, printableToken(resourceType.type), resourceType.count);
  }

  return {
    name: analysis.scenario.name,
    path: analysis.scenario.path,
    root,
    counts: analysis.counts,
    files: fileSummaries,
    alignmentIssues: summarizeAlignment(analysis.alignment),
    resourceTypes: sortedCounts(resourceCounts),
    opcodeUsage: sortedCounts(opcodeCounts, 40),
    linkKinds: sortedCounts(linkCounts, 40),
    diagnostics: {
      unresolvedRefs: analysis.graph?.unresolvedRefs?.length || 0,
      highRiskOpcodes: analysis.graph?.highRiskOpcodes?.length || 0,
      semanticDiagnostics: analysis.semanticSchema?.diagnostics?.length || 0,
    },
    schemaSummary: analysis.semanticSchema?.summary || null,
  };
}

function renderTable(rows, headers) {
  if (!rows.length) return "_None._\n";
  const escape = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  const head = `| ${headers.map((header) => escape(header.label)).join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((header) => escape(header.value(row))).join(" | ")} |`);
  return [head, rule, ...body].join("\n") + "\n";
}

function renderMarkdown(summary) {
  const scenarioRows = summary.scenarios.map((scenario) => ({
    name: scenario.name,
    root: scenario.root,
    levels: scenario.counts.levels,
    triggers: scenario.counts.activeDoors,
    actions: scenario.counts.actions,
    links: scenario.schemaSummary?.linkCount || 0,
    diagnostics: scenario.diagnostics.semanticDiagnostics,
    path: scenario.path,
  }));
  const issueRows = summary.scenarios.flatMap((scenario) =>
    scenario.alignmentIssues.map((issue) => ({
      scenario: scenario.name,
      issue: issue.name,
      records: issue.fullRecords,
      trailing: issue.trailing,
      partial: issue.partialRecords,
    }))
  );
  const failureRows = summary.failures.map((failure) => ({
    name: failure.name,
    path: failure.path,
    error: failure.error,
  }));

  return `# Scenario Corpus Inventory

Generated: ${summary.generatedAt}

This report is generated by \`npm run scenario:inventory\`. It scans configured
scenario roots, runs the utility parser, and records compact corpus-level
evidence for format work. Source material under \`F:\\Realmz\` is read-only.

## Summary

- Roots requested: ${summary.roots.requested.length}
- Roots scanned: ${summary.roots.scanned.length}
- Scenarios discovered: ${summary.total.discovered}
- Scenarios analyzed: ${summary.total.analyzed}
- Failures: ${summary.total.failures}

## Roots

${renderTable(summary.roots.requested.map((root) => ({ root, scanned: summary.roots.scanned.includes(root) ? "yes" : "no" })), [
  { label: "Root", value: (row) => row.root },
  { label: "Scanned", value: (row) => row.scanned },
])}

## Aggregate File Presence

${renderTable(summary.aggregate.filePresence, [
  { label: "File", value: (row) => row.key },
  { label: "Scenarios", value: (row) => row.count },
])}

## Aggregate Resource Types

${renderTable(summary.aggregate.resourceTypes.slice(0, 80), [
  { label: "Type", value: (row) => row.key },
  { label: "Resources", value: (row) => row.count },
])}

## Aggregate Opcode Usage

${renderTable(summary.aggregate.opcodeUsage.slice(0, 120), [
  { label: "Opcode", value: (row) => row.key },
  { label: "Uses", value: (row) => row.count },
])}

## Aggregate Link Kinds

${renderTable(summary.aggregate.linkKinds.slice(0, 120), [
  { label: "Link Kind", value: (row) => row.key },
  { label: "Links", value: (row) => row.count },
])}

## Alignment And Compatibility Notes

${renderTable(issueRows, [
  { label: "Scenario", value: (row) => row.scenario },
  { label: "Container", value: (row) => row.issue },
  { label: "Full Records", value: (row) => row.records },
  { label: "Trailing", value: (row) => row.trailing },
  { label: "Partial", value: (row) => row.partial },
])}

## Scenario Index

${renderTable(scenarioRows, [
  { label: "Scenario", value: (row) => row.name },
  { label: "Levels", value: (row) => row.levels },
  { label: "Triggers", value: (row) => row.triggers },
  { label: "Actions", value: (row) => row.actions },
  { label: "Links", value: (row) => row.links },
  { label: "Diagnostics", value: (row) => row.diagnostics },
  { label: "Path", value: (row) => row.path },
])}

## Failures

${renderTable(failureRows, [
  { label: "Scenario", value: (row) => row.name },
  { label: "Path", value: (row) => row.path },
  { label: "Error", value: (row) => row.error },
])}
`;
}

async function main() {
  const { roots, outDir } = parseArgs(process.argv.slice(2));
  const discovered = [];
  const failures = [];
  const scannedRoots = [];

  for (const root of roots) {
    if (!(await exists(root))) {
      continue;
    }
    scannedRoots.push(root);
    const scenarios = await discoverScenarios(root);
    for (const scenario of scenarios) {
      discovered.push({ ...scenario, root });
    }
  }

  const seenPaths = new Set();
  const scenarios = [];
  const aggregateFiles = new Map();
  const aggregateResources = new Map();
  const aggregateOpcodes = new Map();
  const aggregateLinks = new Map();

  for (const scenario of discovered) {
    const resolved = path.resolve(scenario.path).toLowerCase();
    if (seenPaths.has(resolved)) continue;
    seenPaths.add(resolved);
    try {
      const analysis = await analyzeScenario(scenario.path);
      const item = summarizeScenario(analysis, scenario.root);
      scenarios.push(item);
      for (const file of analysis.files || []) {
        if (file.exists) increment(aggregateFiles, file.name);
      }
      for (const resourceType of analysis.resources?.catalog?.types || []) {
        increment(aggregateResources, printableToken(resourceType.type), resourceType.count);
      }
      for (const action of analysis.graph?.actions || []) {
        increment(aggregateOpcodes, `${action.code}:${action.label}`);
      }
      for (const link of analysis.semanticSchema?.links || []) {
        increment(aggregateLinks, link.kind);
      }
    } catch (error) {
      failures.push({
        name: scenario.name,
        path: scenario.path,
        root: scenario.root,
        error: error?.stack || String(error),
      });
    }
  }

  scenarios.sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
  const summary = {
    generatedAt: new Date().toISOString(),
    roots: {
      requested: roots,
      scanned: scannedRoots,
    },
    total: {
      discovered: discovered.length,
      analyzed: scenarios.length,
      failures: failures.length,
    },
    aggregate: {
      filePresence: sortedCounts(aggregateFiles),
      resourceTypes: sortedCounts(aggregateResources),
      opcodeUsage: sortedCounts(aggregateOpcodes),
      linkKinds: sortedCounts(aggregateLinks),
    },
    scenarios,
    failures,
  };

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "corpus-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outDir, "corpus-inventory.md"), renderMarkdown(summary), "utf8");
  console.log(`Wrote ${path.join(outDir, "corpus-inventory.md")}`);
  console.log(`Wrote ${path.join(outDir, "corpus-summary.json")}`);
  console.log(`Analyzed ${summary.total.analyzed} scenarios (${summary.total.failures} failures).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
