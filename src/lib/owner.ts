// Client-safe constants only. The owner email lives server-side in
// owner.server.ts to avoid leaking PII in the public JS bundle. Use the
// getIsOwner server function (owner.functions.ts) to check owner status.
export const FREE_SUBMISSION_LIMIT = 2;
