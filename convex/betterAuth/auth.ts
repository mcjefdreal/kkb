import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { components } from '../_generated/api.js';
import { type DataModel } from '../_generated/dataModel.js';
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal';
import authConfig from '../auth.config.js';

const siteUrl = process.env.SITE_URL!;

// @ts-expect-error ComponentApi generated types require `npx convex dev` to populate adapter
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuthOptions = (ctx: GenericCtx<DataModel>): BetterAuthOptions => ({
	appName: 'KKB',
	baseURL: siteUrl,
	secret: process.env.BETTER_AUTH_SECRET!,
	database: authComponent.adapter(ctx),
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!
		}
	},
	plugins: [convex({ authConfig })]
});

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx));
