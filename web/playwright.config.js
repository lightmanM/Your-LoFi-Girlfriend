import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'**/*.spec.js',workers:1,timeout:90000,
  reporter:'list',
  use:{channel:'chrome',headless:true,baseURL:'http://127.0.0.1:5173',viewport:{width:1365,height:1000}},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true,timeout:30000},
});
