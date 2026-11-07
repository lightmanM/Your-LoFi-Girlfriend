import {defineConfig} from 'vite';
export default defineConfig({build:{rollupOptions:{input:{viewer:'index.html',studio:'studio.html',room:'room.html',balcony:'balcony.html'}}}});
