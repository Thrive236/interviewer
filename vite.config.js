import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  base: '/interviewer/',
  css: {
    postcss: {
      plugins: [
        autoprefixer({
          overrideBrowserslist: [
            '> 0.5% in CN',
            'Android >= 5',
            'iOS >= 12',
            'Chrome >= 60',
            'Safari >= 12',
            'UCAndroid >= 11',
            'QQAndroid >= 8',
            'Baidu >= 8'
          ]
        })
      ]
    }
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
});
