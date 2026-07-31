// Chạy: cd codebase && npx tsx ../eval/run-eval.ts
// Gọi ĐÚNG pipeline sản phẩm (resolveEffectiveScope + searchDocument + generateTutorAnswer),
// KHÔNG mock LLM — dùng LLMCore thật với LLM_PRIMARY_* trong codebase/.env.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// eval/ nằm ngoài codebase/node_modules nên không resolve được gói "dotenv" —
// tự đọc .env tối giản (KEY=VALUE mỗi dòng) thay vì import "dotenv/config".
function loadDotEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv(join(process.cwd(), ".env"));
import { LLMCore, loadLLMConfig } from "../codebase/server/llm/index.js";
import { generateTutorAnswer } from "../codebase/server/tutor/grounded-generation.js";
import {
  createDocumentIndex,
  resolveEffectiveScope,
  sampleAcrossPages,
  searchDocument,
} from "../codebase/src/rag/indexing.js";
import type { PageContent, QueryScope } from "../codebase/src/types/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));

type ExpectedInsufficient = boolean | "either";

type EvalCase = {
  id: string;
  layer: string;
  difficulty: string;
  question: string;
  scope: QueryScope;
  currentPage: number;
  sourceNote: string;
  expected: {
    insufficientContext: ExpectedInsufficient;
    mustIncludePages?: number[];
    mustOnlyBeAmongPages?: number[];
    minDistinctPages?: number;
  };
  manualReview?: boolean;
  manualReviewNote?: string;
};

type CaseResult = {
  id: string;
  layer: string;
  difficulty: string;
  question: string;
  sourceNote: string;
  manualReview: boolean;
  manualReviewNote?: string;
  expected: EvalCase["expected"];
  actual: {
    effectiveScope: QueryScope;
    insufficientContext: boolean;
    sourcePages: number[];
    answer: string;
    provider?: string;
    model?: string;
    latencyMs?: number;
  };
  pass: boolean | null;
  failReasons: string[];
};

function grade(evalCase: EvalCase, actual: CaseResult["actual"]): { pass: boolean | null; reasons: string[] } {
  if (evalCase.manualReview) return { pass: null, reasons: ["cần soát tay — xem manualReviewNote"] };

  const reasons: string[] = [];
  const { expected } = evalCase;

  if (expected.insufficientContext !== "either" && actual.insufficientContext !== expected.insufficientContext) {
    reasons.push(`insufficientContext mong đợi ${expected.insufficientContext}, thực tế ${actual.insufficientContext}`);
  }

  if (!actual.insufficientContext) {
    if (expected.mustIncludePages) {
      const missing = expected.mustIncludePages.filter((page) => !actual.sourcePages.includes(page));
      if (missing.length > 0) reasons.push(`thiếu trang bắt buộc: ${missing.join(", ")}`);
    }
    if (expected.mustOnlyBeAmongPages) {
      const extra = actual.sourcePages.filter((page) => !expected.mustOnlyBeAmongPages!.includes(page));
      if (extra.length > 0) reasons.push(`lẫn trang ngoài phạm vi cho phép: ${extra.join(", ")}`);
    }
    if (expected.minDistinctPages) {
      const distinct = new Set(actual.sourcePages).size;
      if (distinct < expected.minDistinctPages) {
        reasons.push(`chỉ trích dẫn ${distinct} trang, cần tối thiểu ${expected.minDistinctPages}`);
      }
    }
  }

  return { pass: reasons.length === 0, reasons };
}

async function main() {
  const lessonRaw = JSON.parse(readFileSync(join(HERE, "fixtures", "lesson.json"), "utf-8")) as {
    pages: PageContent[];
  };
  const casesRaw = JSON.parse(readFileSync(join(HERE, "eval_cases.json"), "utf-8")) as { cases: EvalCase[] };

  const index = createDocumentIndex(lessonRaw.pages);
  const llmCore = new LLMCore(loadLLMConfig(process.env));

  const results: CaseResult[] = [];

  for (const evalCase of casesRaw.cases) {
    const effectiveScope = resolveEffectiveScope(evalCase.question, evalCase.scope);
    const searched = searchDocument(index, {
      question: evalCase.question,
      scope: effectiveScope,
      currentPage: evalCase.currentPage,
      limit: effectiveScope === "whole_lesson" ? 12 : 4,
    });
    const evidence = searched.length === 0 && effectiveScope === "whole_lesson"
      ? sampleAcrossPages(index, 12)
      : searched;

    if (evidence.length === 0) {
      const actual: CaseResult["actual"] = {
        effectiveScope,
        insufficientContext: true,
        sourcePages: [],
        answer: "(không có evidence nào được truy xuất — không gọi LLM)",
      };
      const { pass, reasons } = grade(evalCase, actual);
      results.push({
        id: evalCase.id,
        layer: evalCase.layer,
        difficulty: evalCase.difficulty,
        question: evalCase.question,
        sourceNote: evalCase.sourceNote,
        manualReview: Boolean(evalCase.manualReview),
        manualReviewNote: evalCase.manualReviewNote,
        expected: evalCase.expected,
        actual,
        pass,
        failReasons: reasons,
      });
      continue;
    }

    try {
      const response = await generateTutorAnswer(llmCore, {
        question: evalCase.question,
        scope: effectiveScope,
        currentPage: evalCase.currentPage,
        history: [],
        evidence: evidence.map(({ chunk }) => ({
          pageNumber: chunk.pageNumber,
          content: chunk.content,
          sourceType: chunk.sourceType,
          title: chunk.title,
        })),
      });

      const actual: CaseResult["actual"] = {
        effectiveScope,
        insufficientContext: response.insufficientContext,
        sourcePages: response.sourcePages,
        answer: response.answer,
        provider: response.llm.provider,
        model: response.llm.model,
        latencyMs: response.llm.latencyMs,
      };
      const { pass, reasons } = grade(evalCase, actual);
      results.push({
        id: evalCase.id,
        layer: evalCase.layer,
        difficulty: evalCase.difficulty,
        question: evalCase.question,
        sourceNote: evalCase.sourceNote,
        manualReview: Boolean(evalCase.manualReview),
        manualReviewNote: evalCase.manualReviewNote,
        expected: evalCase.expected,
        actual,
        pass,
        failReasons: reasons,
      });
      // eslint-disable-next-line no-console
      console.log(`${evalCase.id}: ${pass === null ? "MANUAL" : pass ? "PASS" : "FAIL"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        id: evalCase.id,
        layer: evalCase.layer,
        difficulty: evalCase.difficulty,
        question: evalCase.question,
        sourceNote: evalCase.sourceNote,
        manualReview: Boolean(evalCase.manualReview),
        manualReviewNote: evalCase.manualReviewNote,
        expected: evalCase.expected,
        actual: { effectiveScope, insufficientContext: false, sourcePages: [], answer: `BLOCKED: ${message}` },
        pass: false,
        failReasons: [`blocked — lỗi khi gọi LLM: ${message}`],
      });
      // eslint-disable-next-line no-console
      console.log(`${evalCase.id}: BLOCKED (${message})`);
    }

    // Free-tier rate limit: chờ giữa các lượt gọi để không bị 429.
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  writeFileSync(join(HERE, "eval_results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  const scored = results.filter((r) => r.pass !== null);
  const passed = scored.filter((r) => r.pass).length;
  const manual = results.filter((r) => r.pass === null);
  const passRate = scored.length > 0 ? (100 * passed) / scored.length : 0;
  const zeroToleranceViolations = results.filter((r) => r.pass === false && (r.layer === "1" || r.expected.insufficientContext === true));

  const bar = 80;
  const gateVerdict = passRate >= bar && zeroToleranceViolations.length === 0 ? "PASS" : "FAIL";

  const lines: string[] = [];
  lines.push("# Kết quả eval — CP3 golden set (20 case)");
  lines.push("");
  lines.push(`Chạy lúc: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`**Quality gate: ${gateVerdict}** — ${passed}/${scored.length} case tự động chấm đạt (${passRate.toFixed(1)}%), bar ≥${bar}%. ${manual.length} case cần soát tay (không tính vào %).`);
  lines.push("");
  if (zeroToleranceViolations.length > 0) {
    lines.push(`⚠️ ${zeroToleranceViolations.length} case fail thuộc nhóm zero-tolerance (lớp ① — nguồn sự thật): ${zeroToleranceViolations.map((v) => v.id).join(", ")}`);
    lines.push("");
  }
  lines.push("| ID | Lớp | Câu hỏi | Kỳ vọng | Thực tế | Kết quả | Ghi chú |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of results) {
    const expectedStr = r.expected.insufficientContext === "either"
      ? "either"
      : r.expected.insufficientContext
        ? "insufficient"
        : `có trang ${JSON.stringify(r.expected.mustIncludePages ?? r.expected.mustOnlyBeAmongPages ?? [])}`;
    const actualStr = r.actual.insufficientContext ? "insufficient" : `trang ${JSON.stringify(r.actual.sourcePages)}`;
    const verdict = r.pass === null ? "SOÁT TAY" : r.pass ? "PASS" : "FAIL";
    lines.push(`| ${r.id} | ${r.layer} | ${r.question.slice(0, 40)}${r.question.length > 40 ? "…" : ""} | ${expectedStr} | ${actualStr} | ${verdict} | ${r.failReasons.join("; ") || r.manualReviewNote || ""} |`);
  }
  writeFileSync(join(HERE, "eval_summary.md"), lines.join("\n") + "\n");

  // eslint-disable-next-line no-console
  console.log(`\nGate: ${gateVerdict} — ${passed}/${scored.length} (${passRate.toFixed(1)}%), ${manual.length} manual review.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
