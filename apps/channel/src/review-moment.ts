/**
 * Cheap code-level gate in front of the model. The bot reads every message in
 * its channels; this decides which ones are worth a model run at all. The
 * model then still has to decide whether there is a finding.
 *
 * Deliberately permissive on review vocabulary and attachments, strict on
 * everything else. The environment owner's speak/silence policy tunes this.
 */

export interface GateMessage {
  text: string;
  hasFiles?: boolean;
  isBot?: boolean;
}

export const REVIEW_PATTERN =
  /\b(review|reviewer|check|sign[- ]?off|revision|rev\b|\br\d\b|doc\b|docx|xlsx|spreadsheet|correction|corrected|instead of|is now|are now|changed?|updated?|inputs?\b|params?\b|v\d[-.]\d|swap|soc\b|before i (sign|fab|order|build))\b/i;

export function isReviewMoment(m: GateMessage): boolean {
  if (m.isBot) return false;
  if (m.hasFiles) return true;
  return REVIEW_PATTERN.test(m.text);
}
