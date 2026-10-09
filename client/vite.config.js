import { defineConfig } from 'vite';
import path from 'node:path';

// Production output goes straight into the CTFd theme. Assets are content-hashed so a CDN or
// nginx can serve them with immutable cache headers.
export default defineConfig(({ mode }) => {
  const toTheme = mode === 'production';
  return {
    base: toTheme ? '/themes/doomsday/static/' : '/',
    server: { fs: { allow: ['..'] } },
    build: {
      outDir: toTheme ? '../theme/doomsday/static' : 'dist-' + mode,
      emptyOutDir: true,
      manifest: true,
      target: 'es2020',
      chunkSizeWarningLimit: 700,
      rollupOptions: { input: { main: path.resolve('index.html'), prepare: path.resolve('prepare.html') } },
    },
    test: { environment: 'node', include: ['test/**/*.test.js'] },
  };
});
