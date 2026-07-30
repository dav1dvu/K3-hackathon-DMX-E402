import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { categories, evalCaseFileSchema } from "./schema.js";

const required = ["missing_information", "ambiguous_context", "unauthorized_action", "high_stakes"] as const;
const raw = JSON.parse(await readFile(resolve("eval/eval_cases.json"), "utf8"));
const parsed = evalCaseFileSchema.parse(raw);
const ids = parsed.cases.map((item) => item.id);
if (new Set(ids).size !== ids.length) throw new Error("Evaluation case IDs must be unique.");

const categoryCounts = Object.fromEntries(categories.map((category) => [category, parsed.cases.filter((item) => item.category === category).length]));
for (const category of required) {
  if (categoryCounts[category] < 2) throw new Error(`${category} must contain at least 2 cases.`);
}
const realWorldCases = parsed.cases.filter((item) => item.provenance.realWorld);
if (realWorldCases.length < 5) throw new Error("At least 5 cases must have real-world provenance.");
for (const item of realWorldCases) {
  if (item.provenance.kind !== "chatlog" || !item.provenance.turnId || !item.provenance.conversationId || !item.provenance.observedQuery) {
    throw new Error(`${item.id} has incomplete real-world provenance.`);
  }
}

console.log(JSON.stringify({ valid: true, total: parsed.cases.length, categoryCounts, realWorldCases: realWorldCases.length }, null, 2));
