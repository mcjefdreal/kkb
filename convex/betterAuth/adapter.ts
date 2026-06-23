import { createApi } from '@convex-dev/better-auth';
import schema from './schema.js';
import { createAuthOptions } from './auth.js';

// Exported for external consumers (e.g., admin scripts, migration tooling).
// The app uses authComponent directly for auth operations.
export const _api = createApi(schema, createAuthOptions);

export const create = _api.create;
export const findOne = _api.findOne;
export const findMany = _api.findMany;
export const updateOne = _api.updateOne;
export const updateMany = _api.updateMany;
export const deleteOne = _api.deleteOne;
export const deleteMany = _api.deleteMany;
