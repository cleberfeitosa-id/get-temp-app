import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        analise: resolve(__dirname, 'analise.html'),
        relatorios: resolve(__dirname, 'relatorios.html'),
        detalhes: resolve(__dirname, 'detalhes_camara.html'),
        ajustes: resolve(__dirname, 'ajustes.html'),
        login: resolve(__dirname, 'login.html'),
        historico: resolve(__dirname, 'historico_alertas.html'),
        nova_camara: resolve(__dirname, 'nova_camara.html'),
        visualizacao: resolve(__dirname, 'visualizacao_relatorio.html')
      }
    }
  }
});
