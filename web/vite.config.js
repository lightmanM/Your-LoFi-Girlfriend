import {defineConfig} from 'vite';
// One page: the balcony scene (index.html). three-vrm is one large chunk by design.
export default defineConfig({build:{chunkSizeWarningLimit:800}});
