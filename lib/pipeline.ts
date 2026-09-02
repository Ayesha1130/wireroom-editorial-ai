import { StageId } from "./types";

/** UI-facing metadata for each stage. Kept separate from lib/types.ts
 * because this is presentation labeling, not pipeline state. */
export const STAGES: { id: StageId; label: string; desk: string }[] = [
  { id: "research", label: "Research", desk: "Research Desk" },
  { id: "draft", label: "Draft", desk: "Writing Desk" },
  { id: "edit", label: "Edit + SEO", desk: "SEO Desk" },
  { id: "verify", label: "Verify", desk: "Evidence Desk" },
  { id: "publish", label: "Review", desk: "Wire Desk" },
];

export type { StageId };
