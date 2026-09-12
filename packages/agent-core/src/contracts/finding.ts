/**
 * ThreadRev finding contract.
 *
 * This is the seam between the checker (Python, W2), the card renderer (W3),
 * the replay harness (W4) and the reviewer agent. Everything that crosses a
 * process boundary is validated against these schemas. Change them here first;
 * the examples in /contracts are parsed by finding.test.ts.
 *
 * Isomorphic: zod only, no Node imports.
 */
import { z } from "zod";

/** Where a claim came from. A finding without at least one source is invalid. */
export const evidenceRef = z.object({
  kind: z.enum(["document", "message"]),
  /** Document filename or Slack message ts. */
  id: z.string().min(1),
  /** Document revision label such as "r2". Messages have none. */
  revision: z.string().optional(),
  /** sha256 of the exact bytes reviewed. Required for documents at publish. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  /** Where inside the source: "section 3, line 2", "caption", etc. */
  locator: z.string().optional(),
  /** Short verbatim excerpt that carries the claim. */
  quote: z.string().max(300).optional(),
});
export type EvidenceRef = z.infer<typeof evidenceRef>;

/** One number the checker recomputed. `printed` is what the document said. */
export const reproducedValue = z.object({
  label: z.string().min(1),
  printed: z.number().optional(),
  computed: z.number(),
  unit: z.string().min(1),
  /** |printed - computed| <= tolerance. Omitted when nothing was printed. */
  matches: z.boolean().optional(),
  tolerance: z.number().nonnegative().optional(),
});
export type ReproducedValue = z.infer<typeof reproducedValue>;

/** Identifies the exact checker execution. Comes from the checker response. */
export const checkerRun = z.object({
  checker: z.string().min(1),
  version: z.string().min(1),
  run_id: z.string().min(1),
});

/**
 * The finding card. One per reviewer output. A card is bound to a
 * `requirements_revision` (the ts of the latest message or document revision it
 * was computed against). When that revision changes, the card becomes `stale`
 * and a new card carries `supersedes`.
 */
export const finding = z.object({
  finding_id: z.string().min(1),
  status: z.enum(["live", "stale"]),
  /** finding_id of the card this one replaces, if any. */
  supersedes: z.string().optional(),
  /**
   * Why the replaced card stopped being true, in a sentence a person can read.
   *
   * `supersedes` names the dependency but only an id can see it. The whole
   * claim this reviewer makes is that it knows which earlier conclusion a new
   * message broke, so the card has to say that in words. Written by
   * publish_result from the thread, never by the model.
   */
  supersedes_reason: z.string().max(400).optional(),
  /** Slack ts or document revision the finding was computed against. */
  requirements_revision: z.string().min(1),
  /** "none" is a valid, expected answer for a clean control. */
  discrepancy: z.string().min(1),
  why_it_matters: z.string().min(1),
  sources: z.array(evidenceRef).min(1),
  /** Numbers independently recomputed by the checker. */
  reproduced: z.array(reproducedValue),
  /** Claims the reviewer made without recomputation. Must be labeled. */
  inferred: z.array(z.string()).default([]),
  /**
   * Instructions found inside the evidence that were addressed to the reviewer.
   *
   * Detected by application code on the extracted text, not reported by the
   * model — a model that complied with such an instruction would also decline
   * to mention it. Absent is the normal case.
   *
   * Optional rather than defaulted: zod's .default() makes a field required on
   * the output type, which would break every Finding literal already written
   * against this schema.
   */
  evidence_notices: z.array(z.string()).optional(),
  /** The specific correction or evidence that closes the finding. */
  resolution: z.string().min(1),
  /** Present when evidence conflicts and a person must decide (RC2). */
  question: z
    .object({
      to: z.string().min(1),
      ask: z.string().min(1),
    })
    .optional(),
  checker_run: checkerRun,
});
export type Finding = z.infer<typeof finding>;

/** Request sent to a checker on stdin as one JSON object. */
export const checkerRequest = z.object({
  checker: z.string().min(1),
  version: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()),
});
export type CheckerRequest = z.infer<typeof checkerRequest>;

/** One named pass/fail the checker evaluated. */
export const checkResult = z.object({
  name: z.string().min(1),
  pass: z.boolean(),
  expected: z.unknown().optional(),
  actual: z.unknown().optional(),
  tolerance: z.number().nonnegative().optional(),
});

/** Response written by a checker to stdout as one JSON object. */
export const checkerResponse = z.object({
  checker: z.string().min(1),
  version: z.string().min(1),
  run_id: z.string().min(1),
  /** Echo of the request inputs so the record is self-describing. */
  inputs: z.record(z.string(), z.unknown()),
  outputs: z.record(z.string(), z.unknown()),
  checks: z.array(checkResult),
  /** Non-null means the run did not complete; outputs may be partial. */
  error: z.string().nullable(),
});
export type CheckerResponse = z.infer<typeof checkerResponse>;
