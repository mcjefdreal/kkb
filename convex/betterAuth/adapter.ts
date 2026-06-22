import { createApi } from '@convex-dev/better-auth';
import schema from './schema.js';
import { createAuthOptions } from './auth.js';

// Exported for external consumers (e.g., admin scripts, migration tooling).
// The app uses authComponent directly for auth operations.
export const api = createApi(schema, createAuthOptions);
