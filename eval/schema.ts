import { z } from "zod";

export const categories = ["normal_grounded", "missing_information", "ambiguous_context", "unauthorized_action", "high_stakes", "multi_page", "ocr_evidence"] as const;
export const categorySchema = z.enum(categories);
export const behaviorSchema = z.enum(["answer", "insufficient_context", "clarify", "refuse"]);

export const evalCaseSchema = z.object({
  id: z.string().regex(/^CP3-\d{3}$/), title: z.string().min(1), category: categorySchema,
  tags: z.array(z.string().min(1)).min(1),
  input: z.object({
    question: z.string().min(1), scope: z.enum(["current_page", "whole_lesson"]), currentPage: z.number().int().positive(),
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) })),
    evidence: z.array(z.object({ pageNumber: z.number().int().positive(), content: z.string().min(1), sourceType: z.enum(["pdf_text", "ocr"]), title: z.string().min(1) })).min(1),
  }),
  expectedResult: z.object({ behavior: behaviorSchema, sourcePages: z.array(z.number().int().positive()), mustContainAny: z.array(z.string().min(1)), mustNotContain: z.array(z.string().min(1)) }),
  actualResult: z.null(), status: z.literal("not_run"), failureReason: z.null(),
  provenance: z.object({ kind: z.enum(["chatlog", "synthetic_edge_case"]), realWorld: z.boolean(), file: z.string().min(1), turnId: z.string().nullable(), conversationId: z.string().nullable(), observedQuery: z.string().nullable(), derivation: z.string().min(1) }),
});

export const evalCaseFileSchema = z.object({ schemaVersion: z.literal("1.0"), createdBeforeFirstRun: z.boolean(), cases: z.array(evalCaseSchema).min(20) });
export type EvalCase = z.infer<typeof evalCaseSchema>;

