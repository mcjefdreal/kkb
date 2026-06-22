declare namespace NodeJS {
	interface ProcessEnv {
		SITE_URL: string;
		BETTER_AUTH_SECRET: string;
		GOOGLE_CLIENT_ID: string;
		GOOGLE_CLIENT_SECRET: string;
		BOT_API_KEY: string;
	}
}

declare const process: {
	env: NodeJS.ProcessEnv;
};
