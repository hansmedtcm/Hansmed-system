// ─────────────────────────────────────────────
// HansMed Agent Pipelines
//
// Pipeline 1: Marketing → Compliance
//   Write content → review before publishing
//
// Pipeline 2: Dev → QA
//   Write code → test before merging
//
// Pipeline 3: Dev → QA → Compliance
//   Write code → test → compliance check
//   (for patient-facing features)
//
// Pipeline 4: Orchestrator
//   You give a task, it routes to the right
//   pipeline automatically
// ─────────────────────────────────────────────

import { AGENTS } from "./agents";
import { callAgent, CallResult } from "./caller";

// ── Shared logger ──────────────────────────────

function log(emoji: string, agent: string, label: string, result?: CallResult) {
  const sep = "─".repeat(60);
  console.log(`\n${sep}`);
  console.log(`${emoji}  ${agent.toUpperCase()} — ${label}`);
  if (result) {
    console.log(`   tokens: ${result.inputTokens} in / ${result.outputTokens} out | ${result.durationMs}ms`);
    if (!result.success) console.log(`   ❌ ERROR: ${result.error}`);
  }
  console.log(sep);
  if (result?.output) console.log(result.output);
}

// ── Pipeline 1: Marketing → Compliance ────────

export interface MarketingPipelineResult {
  topic: string;
  marketingOutput: string;
  complianceOutput: string;
  status: "COMPLIANT" | "FLAG" | "NON-COMPLIANT" | "ERROR";
  safeToPublish: boolean;
}

export async function runMarketingPipeline(
  topic: string
): Promise<MarketingPipelineResult> {
  console.log(`\n🚀 MARKETING PIPELINE STARTED`);
  console.log(`   Topic: ${topic}`);

  // Step 1: Marketing agent writes the content
  const mktResult = await callAgent(
    AGENTS.marketing,
    `Write an Instagram post about: ${topic}.
     Include English caption, Bahasa Malaysia version, and hashtags.`
  );
  log("📣", "Marketing Agent", "content generated", mktResult);

  if (!mktResult.success) {
    return { topic, marketingOutput: "", complianceOutput: "", status: "ERROR", safeToPublish: false };
  }

  // Step 2: Compliance agent reviews the content
  const compResult = await callAgent(
    AGENTS.compliance,
    `Review this HansMed marketing content for compliance before publishing:`,
    mktResult.output
  );
  log("⚖️", "Compliance Agent", "review complete", compResult);

  // Parse compliance status
  const statusMatch = compResult.output.match(/STATUS:\s*(COMPLIANT\s*✅|FLAG\s*⚠️|NON-COMPLIANT\s*❌)/i);
  const rawStatus = statusMatch?.[1] ?? "";
  const status: MarketingPipelineResult["status"] =
    rawStatus.includes("NON-COMPLIANT") ? "NON-COMPLIANT" :
    rawStatus.includes("FLAG")          ? "FLAG"          :
    rawStatus.includes("COMPLIANT")     ? "COMPLIANT"     : "ERROR";

  const safeToPublish = status === "COMPLIANT";

  console.log(`\n✅ MARKETING PIPELINE COMPLETE`);
  console.log(`   Status: ${status} | Safe to publish: ${safeToPublish}`);

  return {
    topic,
    marketingOutput: mktResult.output,
    complianceOutput: compResult.output,
    status,
    safeToPublish,
  };
}

// ── Pipeline 2: Dev → QA ───────────────────────

export interface DevQAPipelineResult {
  feature: string;
  devOutput: string;
  qaOutput: string;
  qaScore: number | null;
  passed: boolean;
}

export async function runDevQAPipeline(
  feature: string
): Promise<DevQAPipelineResult> {
  console.log(`\n🚀 DEV → QA PIPELINE STARTED`);
  console.log(`   Feature: ${feature}`);

  // Step 1: Dev agent writes the code
  const devResult = await callAgent(
    AGENTS.dev,
    `Build this HansMed feature: ${feature}.
     Write production-ready Next.js + TypeScript + Supabase code.`
  );
  log("💻", "Dev Agent", "code generated", devResult);

  if (!devResult.success) {
    return { feature, devOutput: "", qaOutput: "", qaScore: null, passed: false };
  }

  // Step 2: QA agent reviews the code
  const qaResult = await callAgent(
    AGENTS.qa,
    `Review and test this HansMed code. Identify bugs, edge cases, and PDPA issues:`,
    devResult.output
  );
  log("🧪", "QA Agent", "review complete", qaResult);

  // Parse QA score
  const scoreMatch = qaResult.output.match(/SUMMARY SCORE:\s*(\d+)/i);
  const qaScore = scoreMatch ? parseInt(scoreMatch[1]) : null;
  const passed = qaScore !== null ? qaScore >= 7 : !qaResult.output.includes("FAIL");

  console.log(`\n✅ DEV → QA PIPELINE COMPLETE`);
  console.log(`   QA Score: ${qaScore ?? "N/A"}/10 | Passed: ${passed}`);

  return {
    feature,
    devOutput: devResult.output,
    qaOutput: qaResult.output,
    qaScore,
    passed,
  };
}

// ── Pipeline 3: Dev → QA → Compliance ─────────
// Use for patient-facing features that touch health data

export interface FullFeaturePipelineResult {
  feature: string;
  devOutput: string;
  qaOutput: string;
  complianceOutput: string;
  qaScore: number | null;
  complianceStatus: string;
  readyToMerge: boolean;
}

export async function runFullFeaturePipeline(
  feature: string
): Promise<FullFeaturePipelineResult> {
  console.log(`\n🚀 FULL FEATURE PIPELINE (Dev → QA → Compliance) STARTED`);
  console.log(`   Feature: ${feature}`);

  // Step 1: Dev writes the code
  const devResult = await callAgent(
    AGENTS.dev,
    `Build this patient-facing HansMed feature: ${feature}.
     This feature handles health data — be strict about PDPA compliance and encryption.`
  );
  log("💻", "Dev Agent", "code generated", devResult);

  if (!devResult.success) {
    return { feature, devOutput: "", qaOutput: "", complianceOutput: "", qaScore: null, complianceStatus: "ERROR", readyToMerge: false };
  }

  // Step 2: QA tests the code
  const qaResult = await callAgent(
    AGENTS.qa,
    `Test this patient-facing HansMed feature. Pay special attention to
     data security, authentication, and any patient data exposure risks:`,
    devResult.output
  );
  log("🧪", "QA Agent", "testing complete", qaResult);

  // Step 3: Compliance reviews both code and QA results
  const compResult = await callAgent(
    AGENTS.compliance,
    `Review this patient-facing HansMed feature for regulatory compliance.
     Check PDPA data handling, MDA classification risk, and T&CM Act requirements.
     
     QA FINDINGS:
     ${qaResult.output}
     
     CODE TO REVIEW:`,
    devResult.output
  );
  log("⚖️", "Compliance Agent", "compliance review complete", compResult);

  const scoreMatch = qaResult.output.match(/SUMMARY SCORE:\s*(\d+)/i);
  const qaScore = scoreMatch ? parseInt(scoreMatch[1]) : null;

  const statusMatch = compResult.output.match(/STATUS:\s*(COMPLIANT\s*✅|FLAG\s*⚠️|NON-COMPLIANT\s*❌)/i);
  const complianceStatus = statusMatch?.[1]?.trim() ?? "UNKNOWN";

  const readyToMerge =
    (qaScore === null || qaScore >= 7) &&
    complianceStatus.includes("COMPLIANT") &&
    !complianceStatus.includes("NON-COMPLIANT");

  console.log(`\n✅ FULL PIPELINE COMPLETE`);
  console.log(`   QA: ${qaScore ?? "N/A"}/10 | Compliance: ${complianceStatus} | Ready to merge: ${readyToMerge}`);

  return {
    feature,
    devOutput: devResult.output,
    qaOutput: qaResult.output,
    complianceOutput: compResult.output,
    qaScore,
    complianceStatus,
    readyToMerge,
  };
}

// ── Pipeline 4: Orchestrator ───────────────────
// Give any task — it picks the right pipeline

type TaskType = "marketing" | "code" | "patient-feature" | "compliance-check";

function detectTaskType(task: string): TaskType {
  const t = task.toLowerCase();
  if (t.includes("post") || t.includes("content") || t.includes("caption") ||
      t.includes("infographic") || t.includes("social") || t.includes("marketing"))
    return "marketing";
  if (t.includes("patient") || t.includes("health data") || t.includes("portal") ||
      t.includes("tongue") || t.includes("photo") || t.includes("record"))
    return "patient-feature";
  if (t.includes("review") || t.includes("complian") || t.includes("pdpa") || t.includes("tcm act"))
    return "compliance-check";
  return "code";
}

export async function orchestrate(task: string): Promise<void> {
  const taskType = detectTaskType(task);

  console.log(`\n🎯 ORCHESTRATOR`);
  console.log(`   Task: "${task}"`);
  console.log(`   Detected type: ${taskType}`);
  console.log(`   Routing to pipeline...`);

  switch (taskType) {
    case "marketing":
      await runMarketingPipeline(task);
      break;
    case "patient-feature":
      await runFullFeaturePipeline(task);
      break;
    case "compliance-check": {
      const result = await callAgent(AGENTS.compliance, task);
      log("⚖️", "Compliance Agent", "direct review", result);
      break;
    }
    case "code":
    default:
      await runDevQAPipeline(task);
      break;
  }
}
