import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
    },
    define: {
      // Fix: Only expose API_KEY to avoid security warnings about full process.env exposure
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});