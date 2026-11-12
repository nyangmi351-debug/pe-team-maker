import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Firebase·엑셀 라이브러리가 커서 생기는 경고 기준만 올려 둡니다 (동작에는 영향 없음)
    chunkSizeWarningLimit: 2000,
  },
});
