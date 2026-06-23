import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	server: {
		proxy: {
			'/api/auth': {
				target: 'https://upbeat-axolotl-779.convex.site',
				changeOrigin: true,
				configure: (proxy) => {
					proxy.on('proxyReq', (proxyReq) => {
						proxyReq.setHeader('x-forwarded-host', 'localhost:5173');
						proxyReq.setHeader('x-forwarded-proto', 'http');
					});
					proxy.on('proxyRes', (proxyRes) => {
						const setCookie = proxyRes.headers['set-cookie'];
						if (setCookie) {
							proxyRes.headers['set-cookie'] = setCookie.map((c) => {
								let cookie = c
									.replace(/Domain=[^;,\s]+/gi, 'Domain=localhost')
									.replace(/;\s*Secure/gi, '')
									.replace(/SameSite=[^;,\s]+/gi, 'SameSite=Lax')
									.replace(/Path=[^;,\s]+/gi, 'Path=/');
								if (!/Path=/i.test(cookie)) {
									cookie += '; Path=/';
								}
								return cookie;
							});
						}
					});
				}
			},
			'/api/bot': {
				target: 'https://upbeat-axolotl-779.convex.site',
				changeOrigin: true
			},
			'/api': {
				target: 'https://upbeat-axolotl-779.convex.cloud',
				changeOrigin: true,
				ws: true
			}
		}
	}
});
