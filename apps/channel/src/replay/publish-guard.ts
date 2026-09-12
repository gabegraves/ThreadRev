/**
 * Pure guard for `publish_result`: a card may only go live when it was
 * computed against the thread's current requirements revision.
 *
 * Revisions are opaque labels (a Slack ts or a document revision such as
 * "r2"), so the only comparison that means anything is equality. A card bound
 * to any other revision is refused and must be recorded as stale, with its
 * `checker_run.run_id`, inputs and outputs intact, before the reviewer reruns.
 */

export interface RevisionBound {
  requirements_revision: string;
  status: "live" | "stale";
}

export type PublishDecision =
  | { ok: true; revision: string }
  | {
      ok: false;
      reason: "stale_revision";
      cardRevision: string;
      currentRevision: string;
    };

export function guardPublish(
  card: RevisionBound,
  currentRevision: string,
): PublishDecision {
  if (!currentRevision) {
    throw new Error("guardPublish: currentRevision must be a non-empty string");
  }
  if (card.requirements_revision === currentRevision) {
    return { ok: true, revision: currentRevision };
  }
  return {
    ok: false,
    reason: "stale_revision",
    cardRevision: card.requirements_revision,
    currentRevision,
  };
}

/** A stale copy of the card. Does not mutate the input; keeps every field. */
export function markStale<T extends RevisionBound>(card: T): T & { status: "stale" } {
  return { ...card, status: "stale" };
}
