/* Civic report types, narrowed to the ThreadRev evidence corpus.
   A "report" is a finding; its category is checker + card kind. */

export type ReportStatus =
  | "open"
  | "dispatched"
  | "in_progress"
  | "closed"
  | "merged"
  | "rejected";

export type ReportCategory =
  | "rc:discrepancy"
  | "rc:clean"
  | "rc:question"
  | "route:discrepancy"
  | "route:clean"
  | "route:question"
  | "other";
