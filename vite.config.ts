import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleMockApiRequest } from './scripts/mockServer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isDev = mode === 'development';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // 开发环境下，/api/* 请求会被 Mock API 中间件处理
      // 如果需要代理到真实的 Cloudflare Pages 后端，可以设置环境变量 VITE_USE_REAL_API=true
      // 并取消下面的注释
      // proxy: env.VITE_USE_REAL_API === 'true' ? {
      //   '/api': {
      //     target: 'https://your-cloudflare-pages-domain.pages.dev',
      //     changeOrigin: true,
      //   },
      // } : undefined,
    },
    plugins: [
      react(),
      // Mock API 中间件插件
      {
        name: 'mock-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            // 只在开发环境且未配置真实 API 时启用 Mock
            if (isDev && env.VITE_USE_REAL_API !== 'true') {
              const handled = await handleMockApiRequest(req, res);
              if (handled) return;
            }
            next();
          });
        },
      },
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // 开发环境标识
      '__DEV__': isDev,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: isDev,
    }
  };
});
