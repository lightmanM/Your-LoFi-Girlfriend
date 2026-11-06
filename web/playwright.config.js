import {defineConfig} from '@playwright/test';
// PORT lets the suite target another local server (e.g. a second checkout on 5174).
const port=process.env.PORT??'5173',origin=`http://127.0.0.1:${port}`;
export default defineConfig({
  testDir:'./tests',testMatch:'**/*.spec.js',workers:1,timeout:90000,
  reporter:'list',
  use:{channel:'chrome',headless:true,baseURL:origin,viewport:{width:1365,height:1000}},
  webServer:{command:`npx vite --host 127.0.0.1 --port ${port} --strictPort`,url:origin,reuseExistingServer:true,timeout:30000},
});
