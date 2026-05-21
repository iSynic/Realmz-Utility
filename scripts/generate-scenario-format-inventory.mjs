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

function addResourceCoverage(map, type, count, named) {
  const key = printableToken(type);
  const entry = map.get(key) || { key, resources: 0, named: 0, scenarios: 0 };
  entry.resources += count || 0;
  entry.named += named || 0;
  entry.scenarios += 1;
  map.set(key, entry);
}

function sortedResourceCoverage(map, limit = 1000) {
  return [...map.values()]
    .sort((a, b) => b.resources - a.resources || a.key.localeCompare(b.key))
    .slice(0, limit)
    .map((entry) => ({
      ...entry,
      unnamed: Math.max(0, entry.resources - entry.named),
      namedPercent: entry.resources ? Math.round((entry.named / entry.resources) * 1000) / 10 : 0,
    }));
}

function addConfidenceDebtCoverage(map, debt, scenario) {
  const key = debt.group || debt.title || debt.id;
  if (!key) return;
  const entry = map.get(key) || {
    key,
    scenarios: 0,
    claimCount: 0,
    activeUseCount: 0,
    highestImpact: "low",
    worstConfidence: "confirmed",
  };
  entry.scenarios += 1;
  entry.claimCount += debt.count || 0;
  entry.activeUseCount += debt.activeUseCount || 0;
  entry.highestImpact = impactRank(debt.userFacingImpact) > impactRank(entry.highestImpact) ? debt.userFacingImpact : entry.highestImpact;
  entry.worstConfidence = confidenceRank(debt.currentConfidence || debt.confidence) > confidenceRank(entry.worstConfidence)
    ? (debt.currentConfidence || debt.confidence)
    : entry.worstConfidence;
  if (!entry.examples) entry.examples = [];
  if (entry.examples.length < 8) {
    entry.examples.push({
      scenario: scenario.name,
      path: scenario.path,
      summary: debt.summary,
      nextStep: debt.recommendedNextStep,
    });
  }
  map.set(key, entry);
}

function confidenceRank(confidence) {
  return {
    unknown: 5,
    inferred: 4,
    "fixture-backed": 3,
    "runtime-observed": 2,
    "source-backed": 1,
    confirmed: 0,
  }[confidence] ?? 0;
}

function impactRank(impact) {
  return { high: 3, medium: 2, low: 1 }[impact] || 1;
}

function sortedConfidenceDebt(map, limit = 1000) {
  return [...map.values()]
    .sort((a, b) =>
      impactRank(b.highestImpact) - impactRank(a.highestImpact) ||
      confidenceRank(b.worstConfidence) - confidenceRank(a.worstConfidence) ||
      b.activeUseCount - a.activeUseCount ||
      b.claimCount - a.claimCount ||
      a.key.localeCompare(b.key)
    )
    .slice(0, limit);
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
  const unknownOpcodeCounts = new Map();
  const edcdShapeCounts = new Map();
  const fileSummaries = {};
  const missingExtracodes = [];
  const confidenceDebt = analysis.semanticSchema?.decoding?.confidenceDebt || [];
  const confidenceLedger = analysis.semanticSchema?.decoding?.confidenceLedger || [];
  const ed3ReachabilityCases = analysis.semanticSchema?.decoding?.ed3Reachability?.cases || [];
  const dispatcherNoopDiagnostics = (analysis.semanticSchema?.diagnostics || [])
    .filter((diagnostic) => diagnostic.type === "dispatcher-noop");
  const activeUnknownCases = confidenceLedger
    .filter((entry) => entry.subjectType === "unknown-opcode" || entry.group === "active unknown")
    .map((entry) => ({
      subjectId: entry.subjectId,
      confidence: entry.currentConfidence,
      claim: entry.claim,
      nextStep: entry.recommendedNextStep,
      examples: (entry.examples || []).slice(0, 4),
    }));
  let namedResources = 0;
  let totalResources = 0;

  for (const file of analysis.files || []) {
    fileSummaries[file.name] = file.exists
      ? { bytes: file.bytes, sha256: file.sha256 }
      : { exists: false };
  }
  for (const action of analysis.graph?.actions || []) {
    increment(opcodeCounts, `${action.code}:${action.label}`);
    if (action.category === "unknown" || String(action.label || "").startsWith("opcode ")) {
      increment(unknownOpcodeCounts, `${action.rawCode}:${action.label}`);
    }
    if (action.missingExtracode) {
      missingExtracodes.push({
        source: action.source,
        levelType: action.levelType,
        levelIndex: action.levelIndex,
        recordIndex: action.recordIndex,
        slot: action.slot,
        code: action.code,
        edcdId: action.id,
      });
    }
    if (action.extracodeUsage) {
      const fieldShape = (action.extracodeUsage.fields || [])
        .map((field) => field.label)
        .join("; ");
      increment(edcdShapeCounts, `${action.code}:${action.label} | ${fieldShape || "generic five-short row"}`);
    }
  }
  for (const link of analysis.semanticSchema?.links || []) {
    increment(linkCounts, link.kind);
  }
  for (const resourceType of analysis.resources?.catalog?.types || []) {
    increment(resourceCounts, printableToken(resourceType.type), resourceType.count);
    totalResources += resourceType.count || 0;
    namedResources += resourceType.named || 0;
  }

  return {
    name: analysis.scenario.name,
    path: analysis.scenario.path,
    root,
    counts: analysis.counts,
    files: fileSummaries,
    alignmentIssues: summarizeAlignment(analysis.alignment),
    resourceTypes: sortedCounts(resourceCounts),
    resourceNaming: {
      totalResources,
      namedResources,
      unnamedResources: Math.max(0, totalResources - namedResources),
    },
    opcodeUsage: sortedCounts(opcodeCounts, 40),
    unknownOpcodes: sortedCounts(unknownOpcodeCounts, 20),
    edcdShapes: sortedCounts(edcdShapeCounts, 40),
    missingExtracodes: missingExtracodes.slice(0, 40),
    linkKinds: sortedCounts(linkCounts, 40),
    diagnostics: {
      unresolvedRefs: analysis.graph?.unresolvedRefs?.length || 0,
      highRiskOpcodes: analysis.graph?.highRiskOpcodes?.length || 0,
      semanticDiagnostics: analysis.semanticSchema?.diagnostics?.length || 0,
    },
    decoding: analysis.semanticSchema?.decoding?.summary || null,
    confidenceDebt: confidenceDebt.slice(0, 16).map((entry) => ({
      id: entry.id,
      group: entry.group,
      title: entry.title,
      count: entry.count,
      activeUseCount: entry.activeUseCount,
      confidence: entry.currentConfidence || entry.confidence,
      impact: entry.userFacingImpact,
      nextStep: entry.recommendedNextStep,
      examples: (entry.examples || []).slice(0, 3),
    })),
    confidenceLedgerCount: confidenceLedger.length,
    activeUnknownCases,
    dispatcherNoopCases: dispatcherNoopDiagnostics.slice(0, 24).map((diagnostic) => ({
      id: diagnostic.id,
      source: diagnostic.source,
      message: diagnostic.message,
      nextStep: diagnostic.recommendedNextStep,
      data: diagnostic.data,
    })),
    unreferencedEd3Cases: ed3ReachabilityCases
      .filter((entry) => entry.classification !== "reachable-known-path")
      .slice(0, 40)
      .map((entry) => ({
        id: entry.id,
        source: "Data ED3",
        recordIndex: entry.recordIndex,
        classification: entry.classification,
        confidence: entry.confidence,
        actionCount: entry.actionCount,
        rawCodes: entry.rawCodes,
        actionIds: entry.actionIds,
        knownIncomingRefs: entry.knownIncomingRefs || [],
        possibleIncomingRefs: entry.possibleIncomingRefs || [],
        entryPathEvidence: entry.entryPathEvidence || [],
        sourceAnchors: entry.sourceAnchors || [],
        classificationReason: entry.classificationReason || "",
        promotionRule: entry.promotionRule || "",
        neighborSignature: entry.neighborSignature,
        message: entry.summary,
        nextStep: entry.recommendedNextStep,
        examples: entry.examples || [],
      })),
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
    unknownOpcodes: scenario.unknownOpcodes.reduce((sum, item) => sum + item.count, 0),
    unknownClusters: scenario.decoding?.unknownClusterCount || 0,
    formatGapActions: scenario.decoding?.formatGapActionCount || 0,
    unreferencedEd3: scenario.decoding?.unreferencedMacroCount || 0,
    missingExtracodes: scenario.missingExtracodes.length,
    path: scenario.path,
  }));
  const anomalyRows = summary.scenarios
    .filter((scenario) =>
      scenario.diagnostics.semanticDiagnostics ||
      scenario.diagnostics.unresolvedRefs ||
      scenario.unknownOpcodes.length ||
      scenario.missingExtracodes.length ||
      scenario.alignmentIssues.length)
    .map((scenario) => ({
      scenario: scenario.name,
      diagnostics: scenario.diagnostics.semanticDiagnostics,
      unresolvedRefs: scenario.diagnostics.unresolvedRefs,
      unknownOpcodes: scenario.unknownOpcodes.reduce((sum, item) => sum + item.count, 0),
      unknownClusters: scenario.decoding?.unknownClusterCount || 0,
      formatGapActions: scenario.decoding?.formatGapActionCount || 0,
      unreferencedEd3: scenario.decoding?.unreferencedMacroCount || 0,
      missingExtracodes: scenario.missingExtracodes.length,
      alignmentIssues: scenario.alignmentIssues.length,
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
  const missingEdcdRows = summary.scenarios.flatMap((scenario) =>
    scenario.missingExtracodes.map((item) => ({
      scenario: scenario.name,
      source: item.source,
      record: item.recordIndex,
      slot: item.slot,
      code: item.code,
      edcdId: item.edcdId,
    }))
  );
  const confidenceDebtRows = summary.aggregate.confidenceDebt.slice(0, 80).map((entry) => ({
    group: entry.key,
    confidence: entry.worstConfidence,
    impact: entry.highestImpact,
    claims: entry.claimCount,
    active: entry.activeUseCount,
    scenarios: entry.scenarios,
    nextStep: entry.examples?.[0]?.nextStep || "",
  }));
  const scenarioDebtRows = summary.scenarios
    .filter((scenario) => scenario.confidenceDebt?.length)
    .map((scenario) => ({
      scenario: scenario.name,
      debt: scenario.confidenceDebt.length,
      topGroup: scenario.confidenceDebt[0]?.group || "",
      topConfidence: scenario.confidenceDebt[0]?.confidence || "",
      topClaims: scenario.confidenceDebt[0]?.count || 0,
      ledger: scenario.confidenceLedgerCount || 0,
      path: scenario.path,
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

## Aggregate Resource Naming Coverage

${renderTable(summary.aggregate.resourceNamingCoverage.slice(0, 80), [
  { label: "Type", value: (row) => row.key },
  { label: "Resources", value: (row) => row.resources },
  { label: "Named", value: (row) => row.named },
  { label: "Unnamed", value: (row) => row.unnamed },
  { label: "Named %", value: (row) => row.namedPercent },
  { label: "Scenarios", value: (row) => row.scenarios },
])}

## Aggregate Opcode Usage

${renderTable(summary.aggregate.opcodeUsage.slice(0, 120), [
  { label: "Opcode", value: (row) => row.key },
  { label: "Uses", value: (row) => row.count },
])}

## Aggregate Unknown Opcode Usage

Decoding summary: ${summary.aggregate.unknownClusters} open issue clusters across analyzed scenarios; ${summary.aggregate.formatGapActions} action slots were reclassified as preserved format-gap bytes instead of executable unknown opcodes; ${summary.aggregate.unreferencedMacros} Data ED3 rows were classified as unreferenced macro/action evidence.

${renderTable(summary.aggregate.unknownOpcodes.slice(0, 120), [
  { label: "Opcode", value: (row) => row.key },
  { label: "Uses", value: (row) => row.count },
])}

## Aggregate Confidence Debt

These rows are generated from \`semanticSchema.decoding.confidenceDebt\`. They
rank low-confidence claims that need source anchors, fixture assertions, or
runtime evidence before promotion.

${renderTable(confidenceDebtRows, [
  { label: "Debt Group", value: (row) => row.group },
  { label: "Worst Confidence", value: (row) => row.confidence },
  { label: "Impact", value: (row) => row.impact },
  { label: "Claims", value: (row) => row.claims },
  { label: "Active Uses", value: (row) => row.active },
  { label: "Scenarios", value: (row) => row.scenarios },
  { label: "Next Step", value: (row) => row.nextStep },
])}

## Aggregate EDCD Shape Coverage

${renderTable(summary.aggregate.edcdShapes.slice(0, 160), [
  { label: "Opcode Shape", value: (row) => row.key },
  { label: "Uses", value: (row) => row.count },
])}

## Aggregate Link Kinds

${renderTable(summary.aggregate.linkKinds.slice(0, 120), [
  { label: "Link Kind", value: (row) => row.key },
  { label: "Links", value: (row) => row.count },
])}

## Diagnostics And Anomalies

${renderTable(anomalyRows, [
  { label: "Scenario", value: (row) => row.scenario },
  { label: "Diagnostics", value: (row) => row.diagnostics },
  { label: "Unresolved Refs", value: (row) => row.unresolvedRefs },
  { label: "Unknown Opcodes", value: (row) => row.unknownOpcodes },
  { label: "Open Issue Clusters", value: (row) => row.unknownClusters },
  { label: "Format Gaps", value: (row) => row.formatGapActions },
  { label: "Unreferenced ED3", value: (row) => row.unreferencedEd3 },
  { label: "Missing EDCD", value: (row) => row.missingExtracodes },
  { label: "Alignment Issues", value: (row) => row.alignmentIssues },
])}

## Scenario Confidence Debt

${renderTable(scenarioDebtRows, [
  { label: "Scenario", value: (row) => row.scenario },
  { label: "Debt Rows", value: (row) => row.debt },
  { label: "Top Group", value: (row) => row.topGroup },
  { label: "Top Confidence", value: (row) => row.topConfidence },
  { label: "Top Claims", value: (row) => row.topClaims },
  { label: "Ledger Entries", value: (row) => row.ledger },
  { label: "Path", value: (row) => row.path },
])}

## Alignment And Compatibility Notes

${renderTable(issueRows, [
  { label: "Scenario", value: (row) => row.scenario },
  { label: "Container", value: (row) => row.issue },
  { label: "Full Records", value: (row) => row.records },
  { label: "Trailing", value: (row) => row.trailing },
  { label: "Partial", value: (row) => row.partial },
])}

## Missing EDCD References

${renderTable(missingEdcdRows, [
  { label: "Scenario", value: (row) => row.scenario },
  { label: "Source", value: (row) => row.source },
  { label: "Record", value: (row) => row.record },
  { label: "Slot", value: (row) => row.slot },
  { label: "Opcode", value: (row) => row.code },
  { label: "EDCD Row", value: (row) => row.edcdId },
])}

## Scenario Index

${renderTable(scenarioRows, [
  { label: "Scenario", value: (row) => row.name },
  { label: "Levels", value: (row) => row.levels },
  { label: "Triggers", value: (row) => row.triggers },
  { label: "Actions", value: (row) => row.actions },
  { label: "Links", value: (row) => row.links },
  { label: "Diagnostics", value: (row) => row.diagnostics },
  { label: "Unknown Opcodes", value: (row) => row.unknownOpcodes },
  { label: "Open Issue Clusters", value: (row) => row.unknownClusters },
  { label: "Format Gaps", value: (row) => row.formatGapActions },
  { label: "Unreferenced ED3", value: (row) => row.unreferencedEd3 },
  { label: "Missing EDCD", value: (row) => row.missingExtracodes },
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

function renderConfidenceDebtCases(summary) {
  const rows = summary.scenarios.flatMap((scenario) =>
    (scenario.confidenceDebt || []).slice(0, 8).map((debt) => ({
      scenario: scenario.name,
      group: debt.group,
      confidence: debt.confidence,
      impact: debt.impact,
      claims: debt.count,
      active: debt.activeUseCount,
      nextStep: debt.nextStep,
      path: scenario.path,
    }))
  );
  return `# Confidence Debt Case Files

Generated: ${summary.generatedAt}

These rows are generated from \`semanticSchema.decoding.confidenceDebt\`. They
are the audit queue for claims that are still \`unknown\`, \`inferred\`, or
\`fixture-backed\`.

${renderTable(rows, [
  { label: "Scenario", value: (row) => row.scenario },
  { label: "Group", value: (row) => row.group },
  { label: "Confidence", value: (row) => row.confidence },
  { label: "Impact", value: (row) => row.impact },
  { label: "Claims", value: (row) => row.claims },
  { label: "Active Uses", value: (row) => row.active },
  { label: "Next Step", value: (row) => row.nextStep },
  { label: "Path", value: (row) => row.path },
])}
`;
}

function renderActiveUnknownCases(summary) {
  const rows = summary.scenarios.flatMap((scenario) =>
    (scenario.activeUnknownCases || []).flatMap((entry) =>
      (entry.examples?.length ? entry.examples : [{ data: {} }]).map((example) => {
        const data = example.data || {};
        return {
          scenario: scenario.name,
          subject: entry.subjectId,
          confidence: entry.confidence,
          source: data.source || example.source || "",
          level: data.levelType && data.levelIndex != null ? `${data.levelType} ${data.levelIndex}` : "",
          record: data.recordIndex ?? "",
          slot: data.slot ?? "",
          rawCode: data.rawCode ?? "",
          edcdId: data.id ?? "",
          nextStep: entry.nextStep,
          path: scenario.path,
        };
      })
    )
  );
  return `# Active Unknown Opcode Cases

Generated: ${summary.generatedAt}

These cases are active action words that the parser still refuses to assign a
friendly behavior. They should be investigated against \`newland.c\`, generated
opcode maps, EDCD neighbors, and runtime evidence before any semantic promotion.

${renderTable(rows, [
  { label: "Scenario", value: (row) => row.scenario },
  { label: "Subject", value: (row) => row.subject },
  { label: "Confidence", value: (row) => row.confidence },
  { label: "Source", value: (row) => row.source },
  { label: "Level", value: (row) => row.level },
  { label: "Record", value: (row) => row.record },
  { label: "Slot", value: (row) => row.slot },
  { label: "Raw Code", value: (row) => row.rawCode },
  { label: "EDCD Row", value: (row) => row.edcdId },
  { label: "Next Step", value: (row) => row.nextStep },
  { label: "Path", value: (row) => row.path },
])}
`;
}

function renderDispatcherNoopCases(summary) {
  const rows = summary.scenarios.flatMap((scenario) =>
    (scenario.dispatcherNoopCases || []).map((entry) => ({
      scenario: scenario.name,
      source: entry.source,
      level: entry.data?.levelType && entry.data?.levelIndex != null ? `${entry.data.levelType} ${entry.data.levelIndex}` : "",
      record: entry.data?.recordIndex ?? "",
      slot: entry.data?.slot ?? "",
      rawCode: entry.data?.rawCode ?? "",
      id: entry.data?.id ?? "",
      message: entry.message,
      nextStep: entry.nextStep,
      path: scenario.path,
    }))
  );
  return `# Dispatcher No-Op Action Cases

Generated: ${summary.generatedAt}

These action words are source-backed no-ops: \`newland.c\` has no matching
\`switch (code)\` case, so the runtime dispatcher ignores them. Their runtime
effect is known, but their authored/editor intent can still be investigated
from neighboring actions and corpus context.

${renderTable(rows, [
  { label: "Scenario", value: (row) => row.scenario },
  { label: "Source", value: (row) => row.source },
  { label: "Level", value: (row) => row.level },
  { label: "Record", value: (row) => row.record },
  { label: "Slot", value: (row) => row.slot },
  { label: "Raw Code", value: (row) => row.rawCode },
  { label: "ID", value: (row) => row.id },
  { label: "Message", value: (row) => row.message },
  { label: "Next Step", value: (row) => row.nextStep },
  { label: "Path", value: (row) => row.path },
])}
`;
}

function renderUnreferencedEd3Cases(summary) {
  const rows = summary.scenarios.flatMap((scenario) =>
    (scenario.unreferencedEd3Cases || []).map((entry) => ({
      scenario: scenario.name,
      source: entry.source,
      record: entry.recordIndex ?? "",
      classification: entry.classification || "",
      confidence: entry.confidence || "",
      actions: entry.actionCount ?? "",
      rawCodes: (entry.rawCodes || []).join(", "),
      actionIds: (entry.actionIds || []).join(", "),
      knownIncoming: (entry.knownIncomingRefs || []).map((ref) => `${ref.from}:${ref.kind}`).join("; "),
      possibleIncoming: (entry.possibleIncomingRefs || []).map((ref) => `${ref.source || ""}:${ref.reason || ""}`).join("; "),
      entryPaths: (entry.entryPathEvidence || []).map((ref) => `${ref.pathStatus || ""}:${ref.rootType || ""}:${ref.from || ref.source || ""}:${ref.kind || ref.reason || ""}`).join("; "),
      sourceAnchors: (entry.sourceAnchors || []).join("; "),
      classificationReason: entry.classificationReason || "",
      promotionRule: entry.promotionRule || "",
      neighbors: entry.neighborSignature ? JSON.stringify(entry.neighborSignature) : "",
      message: entry.message,
      nextStep: entry.nextStep,
      path: scenario.path,
    }))
  );
  return `# Unreferenced Data ED3 Cases

Generated: ${summary.generatedAt}

These non-empty \`Data ED3\` rows are preserved as macro/action bytes but are not
currently reachable from decoded source-backed macro roots such as map triggers,
recursive macro calls, named \`Global\` slots, timed encounters, random-region
doors, negative battle macros, or monster death hooks. Classification is
evidence-safe: rows are not promoted to executable semantics without a
source-backed incoming path.

${renderTable(rows, [
  { label: "Scenario", value: (row) => row.scenario },
  { label: "Source", value: (row) => row.source },
  { label: "Record", value: (row) => row.record },
  { label: "Classification", value: (row) => row.classification },
  { label: "Confidence", value: (row) => row.confidence },
  { label: "Actions", value: (row) => row.actions },
  { label: "Raw Codes", value: (row) => row.rawCodes },
  { label: "Action IDs", value: (row) => row.actionIds },
  { label: "Known Incoming", value: (row) => row.knownIncoming },
  { label: "Possible Incoming", value: (row) => row.possibleIncoming },
  { label: "Entry Paths", value: (row) => row.entryPaths },
  { label: "Source Anchors", value: (row) => row.sourceAnchors },
  { label: "Classification Reason", value: (row) => row.classificationReason },
  { label: "Promotion Rule", value: (row) => row.promotionRule },
  { label: "Neighbors", value: (row) => row.neighbors },
  { label: "Message", value: (row) => row.message },
  { label: "Next Step", value: (row) => row.nextStep },
  { label: "Path", value: (row) => row.path },
])}
`;
}

function renderEd3EntryPathAudit(summary) {
  const rows = summary.scenarios.flatMap((scenario) =>
    (scenario.unreferencedEd3Cases || []).flatMap((entry) =>
      (entry.entryPathEvidence || []).map((path) => ({
        scenario: scenario.name,
        record: entry.recordIndex ?? "",
        classification: entry.classification || "",
        status: path.pathStatus || "",
        rootType: path.rootType || "",
        from: path.from || path.source || "",
        kind: path.kind || path.reason || "",
        confidence: path.confidence || "",
        sourceAnchor: path.sourceAnchor || "",
        promotionRule: entry.promotionRule || "",
        path: scenario.path,
      }))
    )
  );
  return `# ED3 Entry Path Audit

Generated: ${summary.generatedAt}

This report lists source-backed and possible entry paths that mention \`Data ED3\`
macro records. Known paths can promote a row to reachable semantics. Possible
paths, especially runtime copy/replace behavior, remain evidence only until a
source-backed execution path or targeted runtime trace proves execution.

${renderTable(rows, [
  { label: "Scenario", value: (row) => row.scenario },
  { label: "ED3 Record", value: (row) => row.record },
  { label: "Classification", value: (row) => row.classification },
  { label: "Path Status", value: (row) => row.status },
  { label: "Root Type", value: (row) => row.rootType },
  { label: "From", value: (row) => row.from },
  { label: "Kind", value: (row) => row.kind },
  { label: "Confidence", value: (row) => row.confidence },
  { label: "Source Anchor", value: (row) => row.sourceAnchor },
  { label: "Promotion Rule", value: (row) => row.promotionRule },
  { label: "Path", value: (row) => row.path },
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
  const aggregateUnknownOpcodes = new Map();
  const aggregateEdcdShapes = new Map();
  const aggregateLinks = new Map();
  const aggregateResourceCoverage = new Map();
  const aggregateConfidenceDebt = new Map();
  let aggregateUnknownClusters = 0;
  let aggregateFormatGapActions = 0;
  let aggregateUnreferencedMacros = 0;

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
        addResourceCoverage(aggregateResourceCoverage, resourceType.type, resourceType.count, resourceType.named);
      }
      for (const action of analysis.graph?.actions || []) {
        increment(aggregateOpcodes, `${action.code}:${action.label}`);
        if (action.category === "unknown" || String(action.label || "").startsWith("opcode ")) {
          increment(aggregateUnknownOpcodes, `${action.rawCode}:${action.label}`);
        }
        if (action.extracodeUsage) {
          const fieldShape = (action.extracodeUsage.fields || [])
            .map((field) => field.label)
            .join("; ");
          increment(aggregateEdcdShapes, `${action.code}:${action.label} | ${fieldShape || "generic five-short row"}`);
        }
      }
      for (const link of analysis.semanticSchema?.links || []) {
        increment(aggregateLinks, link.kind);
      }
      for (const debt of analysis.semanticSchema?.decoding?.confidenceDebt || []) {
        addConfidenceDebtCoverage(aggregateConfidenceDebt, debt, item);
      }
      aggregateUnknownClusters += analysis.semanticSchema?.decoding?.summary?.unknownClusterCount || 0;
      aggregateFormatGapActions += analysis.semanticSchema?.decoding?.summary?.formatGapActionCount || 0;
      aggregateUnreferencedMacros += analysis.semanticSchema?.decoding?.summary?.unreferencedMacroCount || 0;
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
      resourceNamingCoverage: sortedResourceCoverage(aggregateResourceCoverage),
      opcodeUsage: sortedCounts(aggregateOpcodes),
      unknownOpcodes: sortedCounts(aggregateUnknownOpcodes),
      unknownClusters: aggregateUnknownClusters,
      formatGapActions: aggregateFormatGapActions,
      unreferencedMacros: aggregateUnreferencedMacros,
      confidenceDebt: sortedConfidenceDebt(aggregateConfidenceDebt),
      edcdShapes: sortedCounts(aggregateEdcdShapes),
      linkKinds: sortedCounts(aggregateLinks),
    },
    scenarios,
    failures,
  };

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "corpus-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outDir, "corpus-inventory.md"), renderMarkdown(summary), "utf8");
  await fs.writeFile(path.join(outDir, "confidence-debt-cases.md"), renderConfidenceDebtCases(summary), "utf8");
  await fs.writeFile(path.join(outDir, "active-unknown-opcode-cases.md"), renderActiveUnknownCases(summary), "utf8");
  await fs.writeFile(path.join(outDir, "dispatcher-noop-action-cases.md"), renderDispatcherNoopCases(summary), "utf8");
  await fs.writeFile(path.join(outDir, "unreferenced-ed3-cases.md"), renderUnreferencedEd3Cases(summary), "utf8");
  await fs.writeFile(path.join(outDir, "ed3-entry-path-audit.md"), renderEd3EntryPathAudit(summary), "utf8");
  console.log(`Wrote ${path.join(outDir, "corpus-inventory.md")}`);
  console.log(`Wrote ${path.join(outDir, "corpus-summary.json")}`);
  console.log(`Wrote ${path.join(outDir, "confidence-debt-cases.md")}`);
  console.log(`Wrote ${path.join(outDir, "active-unknown-opcode-cases.md")}`);
  console.log(`Wrote ${path.join(outDir, "dispatcher-noop-action-cases.md")}`);
  console.log(`Wrote ${path.join(outDir, "unreferenced-ed3-cases.md")}`);
  console.log(`Wrote ${path.join(outDir, "ed3-entry-path-audit.md")}`);
  console.log(`Analyzed ${summary.total.analyzed} scenarios (${summary.total.failures} failures).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
