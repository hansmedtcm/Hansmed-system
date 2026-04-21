// ─────────────────────────────────────────────
// HansMed Agent System — Main Entry Point
//
// Usage:
//   npx ts-node src/index.ts marketing "ginger benefits"
//   npx ts-node src/index.ts dev "patient booking form"
//   npx ts-node src/index.ts full "patient photo upload"
//   npx ts-node src/index.ts auto "write a post about tongue diagnosis"
// ─────────────────────────────────────────────

import {
  runMarketingPipeline,
  runDevQAPipeline,
  runFullFeaturePipeline,
  orchestrate,
} from "./pipelines";
import { getSessionStats } from "./caller";

async function main() {
  const [, , command, ...rest] = process.argv;
  const task = rest.join(" ");

  if (!command || !task) {
    console.log(`
╔══════════════════════════════════════╗
║   HansMed Agent System               ║
╠══════════════════════════════════════╣
║  Commands:                            ║
║  marketing  <topic>   📣 → ⚖️         ║
║  dev        <feature> 💻 → 🧪         ║
║  full       <feature> 💻 → 🧪 → ⚖️   ║
║  auto       <task>    🎯 auto-route   ║
╚══════════════════════════════════════╝

Examples:
  npx ts-node src/index.ts marketing "ginger benefits for digestion"
  npx ts-node src/index.ts dev "appointment booking form component"
  npx ts-node src/index.ts full "patient photo upload with PDPA consent"
  npx ts-node src/index.ts auto "write a post about tongue analysis"
    `);
    process.exit(0);
  }

  const startTime = Date.now();

  switch (command) {
    case "marketing":
      await runMarketingPipeline(task);
      break;
    case "dev":
      await runDevQAPipeline(task);
      break;
    case "full":
      await runFullFeaturePipeline(task);
      break;
    case "auto":
      await orchestrate(task);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }

  // Print session cost summary
  const stats = getSessionStats();
  const totalMs = Date.now() - startTime;

  console.log(`
╔══════════════════════════════════════╗
║   Session Summary                     ║
╠══════════════════════════════════════╣
║  API calls:    ${String(stats.calls).padEnd(22)} ║
║  Input tokens: ${String(stats.totalInputTokens).padEnd(22)} ║
║  Output tokens:${String(stats.totalOutputTokens).padEnd(22)} ║
║  Est. cost:    $${stats.estimatedCostUSD.toFixed(5).padEnd(21)} ║
║  Total time:   ${String(Math.round(totalMs / 1000) + "s").padEnd(22)} ║
╚══════════════════════════════════════╝
  `);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
