/**
 * Isomorphic schemas and types. Safe in a browser bundle — no Node imports.
 */
import { z } from "zod";

export const searchWebParameters = z.object({
  query: z.string().trim().min(1).describe("What to search for, phrased as a natural-language question."),
  results: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("Set only when the user requests a result count (1–10); otherwise omit."),
});

export type SearchWebArgs = z.infer<typeof searchWebParameters>;

export interface SearchHit {
  title: string;
  url: string;
  published?: string;
  highlight?: string;
}
