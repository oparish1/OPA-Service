/**
 * The projection `authz-service/fixtures/matrix.snapshot.json` stores: the
 * allowed capability ids in order and each denied id mapped to its reason. The
 * codegen generator writes the snapshot and the gateway transport smoke compares
 * the live map against it, so the shape lives here rather than being re-derived
 * by each consumer.
 */

export interface AuthzDecision {
  allowed: boolean;
  reason: string;
}

export interface AuthzSnapshotEntry {
  allowed: string[];
  denied: Record<string, string>;
}

export function snapshotEntry(decisions: Record<string, AuthzDecision>): AuthzSnapshotEntry {
  const allowed: string[] = [];
  const denied: Record<string, string> = {};
  for (const capability of Object.keys(decisions).sort()) {
    if (decisions[capability].allowed) allowed.push(capability);
    else denied[capability] = decisions[capability].reason;
  }
  return { allowed, denied };
}
