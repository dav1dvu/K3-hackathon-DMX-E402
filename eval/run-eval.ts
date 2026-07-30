import "dotenv/config";
import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { LLMCore, LLMError, loadLLMConfig } from "../backend/src/llm/index.js";
import { generateTutorAnswer } from "../backend/src/tutor/grounded-generation.js";
import { categories, evalCaseFileSchema, type EvalCase } from "./schema.js";

const resultPath = resolve("eval/eval_results.json");
try {
  await access(resultPath, constants.F_OK);
  throw new Error("eval_results.json already exists. The first-run artifact is immutable; move it explicitly before a new run.");
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
}

const caseFile = evalCaseFileSchema.parse(JSON.parse(await readFile(resolve("eval/eval_cases.json"), "utf8")));
const config = loadLLMConfig();
const core = new LLMCore(config);
const startedAt = new Date().toISOString();

function samePages(actual: number[], expected: number[]) {
  return [...actual].sort((a, b) => a - b).join(",") === [...expected].sort((a, b) => a - b).join(",");
}

function evaluate(item: EvalCase, actual: Awaited<ReturnType<typeof generateTutorAnswer>>) {
  const failures: string[] = [];
  const criticalFailures: string[] = [];
  const answer = actual.answer.toLocaleLowerCase("vi");
  const evidencePages = new Set(item.input.evidence.map((entry) => entry.pageNumber));
  const actualPages = [...new Set(actual.citations.flatMap((citation) => {
    const pages: number[] = [];
    for (let page = citation.page_start; page <= citation.page_end; page += 1) pages.push(page);
    return pages;
  }))];
  if (actualPages.some((page) => !evidencePages.has(page))) criticalFailures.push("INVALID_CITATION");
  const isInsufficient = actual.status === "insufficient_context";
  if (item.expectedResult.behavior !== "answer" && !isInsufficient) criticalFailures.push("UNSUPPORTED_ASSERTED_ANSWER");
  if (item.expectedResult.behavior === "answer" && isInsufficient) failures.push("Expected a grounded answer but received status=insufficient_context.");
  if (item.expectedResult.behavior !== "answer" && !isInsufficient) failures.push(`Expected ${item.expectedResult.behavior} but model asserted an answer.`);
  if (!samePages(actualPages, item.expectedResult.sourcePages)) failures.push(`Expected sourcePages [${item.expectedResult.sourcePages}], received [${actualPages}].`);
  if (item.expectedResult.mustContainAny.length && !item.expectedResult.mustContainAny.some((term) => answer.includes(term.toLocaleLowerCase("vi")))) failures.push(`Answer contains none of: ${item.expectedResult.mustContainAny.join(", ")}.`);
  const forbidden = item.expectedResult.mustNotContain.filter((term) => answer.includes(term.toLocaleLowerCase("vi")));
  if (forbidden.length) failures.push(`Answer contains forbidden term(s): ${forbidden.join(", ")}.`);
  if (item.expectedResult.behavior === "clarify" && !["làm rõ", "cụ thể", "thêm thông tin", "ngữ cảnh", "ý bạn", "không hiểu"].some((term) => answer.includes(term))) failures.push("Clarification response does not request clarification.");
  if (item.expectedResult.behavior === "refuse" && !["không thể", "không có quyền", "không hỗ trợ", "không truy cập", "chỉ"].some((term) => answer.includes(term))) failures.push("Refusal response does not state a capability boundary.");
  return { failures, criticalFailures };
}

const results = [];
for (const item of caseFile.cases) {
  try {
    const response = await generateTutorAnswer(core, item.input);
    const check = evaluate(item, response);
    results.push({ ...item, actualResult: response, status: check.failures.length || check.criticalFailures.length ? "fail" : "pass", failureReason: [...check.failures, ...check.criticalFailures].join(" ") || null, criticalFailures: check.criticalFailures });
  } catch (error) {
    const code = error instanceof LLMError ? error.code : "UNEXPECTED_ERROR";
    results.push({ ...item, actualResult: null, status: "blocked", failureReason: `No model output: ${code}.`, criticalFailures: [] });
  }
}

const passed = results.filter((item) => item.status === "pass").length;
const failed = results.filter((item) => item.status === "fail").length;
const blocked = results.filter((item) => item.status === "blocked").length;
const criticalFailures = results.flatMap((item) => item.criticalFailures.map((code) => ({ id: item.id, code })));
const executable = passed + failed;
const passRate = executable ? passed / executable : 0;
const qualityGate = blocked ? "UNVERIFIED" : passRate >= 0.8 && !criticalFailures.length ? "PASS" : "FAIL";
const categoryCounts = Object.fromEntries(categories.map((category) => [category, results.filter((item) => item.category === category).length]));
const artifact = {
  schemaVersion: "1.0", runId: "cp3-first-run", startedAt, completedAt: new Date().toISOString(),
  configuration: { provider: config.primary.name, model: config.primary.model, fallbackConfigured: Boolean(config.fallback) },
  acceptanceStandard: { minimumPassRate: 0.8, zeroTolerance: ["UNSUPPORTED_ASSERTED_ANSWER", "INVALID_CITATION"] },
  summary: { total: results.length, passed, failed, blocked, passRate, qualityGate, criticalFailureCount: criticalFailures.length, categoryCounts, realWorldCases: results.filter((item) => item.provenance.realWorld).length },
  criticalFailures, results,
};
await writeFile(resultPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

const failedRows = results.filter((item) => item.status !== "pass").map((item) => `| ${item.id} | ${item.status} | ${item.failureReason?.replaceAll("|", "\\|")} |`).join("\n") || "| — | — | Không có |";
const summary = `# Kết quả evaluation CP3 — lần chạy đầu tiên\n\n- Model/provider: \`${config.primary.model}\` / \`${config.primary.name}\`\n- Kết quả: **${passed}/${results.length} pass**, ${failed} fail, ${blocked} blocked\n- Pass rate trên case thực thi: **${(passRate * 100).toFixed(1)}%**\n- Zero-tolerance failures: **${criticalFailures.length}**\n- Quality gate: **${qualityGate}**\n- Case từ quan sát thực tế: **${artifact.summary.realWorldCases}**\n\n## Số case theo nhóm\n\n${Object.entries(categoryCounts).map(([name, count]) => `- \`${name}\`: ${count}`).join("\n")}\n\n## Khoảng cách so với chuẩn\n\nChuẩn cố định là >=80%, không có case blocked và không có lỗi zero-tolerance. Kết luận lần chạy: **${qualityGate}**.\n\n| Case | Trạng thái | Failure reason |\n|---|---|---|\n${failedRows}\n\nActual output đầy đủ của từng case nằm trong \`eval_results.json\`.\n`;
await writeFile(resolve("eval/eval_summary.md"), summary, "utf8");
console.log(JSON.stringify(artifact.summary, null, 2));

