import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
    },
    define: {
      // Polyfill process.env untuk kompatibilitas kode lama yang menggunakan process.env.API_KEY
      'process.env': env
    }
  };
});