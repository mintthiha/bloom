/** Sets the shared secret so the internalAuth middleware passes in tests. */
process.env.INTERNAL_API_SECRET = "test-secret";

export const INTERNAL_SECRET = "test-secret";
