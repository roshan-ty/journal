import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],publicDir:false,define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:'dist-embed',lib:{entry:'src/embed.jsx',name:'TradersYardJournal',formats:['es'],fileName:'tradersyard-journal',cssFileName:'tradersyard-journal'},rollupOptions:{output:{inlineDynamicImports:true}}}});
