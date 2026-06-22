import { createApi } from '@convex-dev/better-auth';
import schema from './schema.js';
import { createAuthOptions } from './auth.js';

export const api = createApi(schema, createAuthOptions);
