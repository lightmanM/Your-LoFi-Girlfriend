// Isolated Chromium benchmark. CPU is process CPU time / wall time, 100% = one core.
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
const output=new URL('../docs/performance/current-mvp.json',import.meta.url);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const root=await browser.newBrowserCDPSession();
 const info=await root.send('SystemInfo.getInfo');
 const context=await browser.newContext({viewport:{width:1440,height:1050},deviceScaleFactor:2});
 const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function sample(){
  const processes=(await root.send('SystemInfo.getProcessInfo')).processInfo;
  const rssText=execFileSync('/bin/ps',['-p',processes.map(p=>p.id).join(','),'-o','pid=,rss='],{encoding:'utf8'});
  const rss=new Map(rssText.trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number)));
  const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  return {at:performance.now(),processes:processes.map(p=>({...p,rssMiB:(rss.get(p.id)??0)/1024})),metrics};
 }
 async function stage(name,seconds){
  const start=await sample();
  const before=await page.evaluate(()=>window.lofiRoom?.snapshot()??null);
  const frameData=await page.evaluate(async seconds=>{
   const intervals=[],jointSamples=[];let last=performance.now();const stop=last+seconds*1000;
   return new Promise(resolve=>{
    const timer=setTimeout(()=>resolve({intervals,jointSamples,visibility:document.visibilityState}),seconds*1000+150);
    function tick(now){intervals.push(now-last);last=now;
     if(window.lofiRoom){const s=lofiRoom.snapshot();jointSamples.push({upperArm:s.joints.rightUpperArm.quaternion,finger:s.joints.rightIndexProximal.quaternion,smile:s.faceMorphs.Mouth_Smile1,head:s.joints.head.position});}
     if(now<stop)requestAnimationFrame(tick);else{clearTimeout(timer);resolve({intervals,jointSamples,visibility:document.visibilityState});}
    }requestAnimationFrame(tick);
   });
  },seconds);
  const end=await sample(),wall=(end.at-start.at)/1000;
  const processes=end.processes.map(p=>{const prev=start.processes.find(a=>a.id===p.id);return {type:p.type,pid:p.id,cpuPercentOfOneCore:prev?(p.cpuTime-prev.cpuTime)/wall*100:null,rssMiB:p.rssMiB};});
  const intervals=frameData.intervals.slice(1).sort((a,b)=>a-b);
  const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))));
  const rows=frameData.jointSamples,first=rows[0];
  const result={name,seconds:wall,visibility:frameData.visibility,processes,totalCpuPercentOfOneCore:processes.reduce((s,p)=>s+(p.cpuPercentOfOneCore??0),0),summedRssMiB:processes.reduce((s,p)=>s+p.rssMiB,0),jsHeapUsedMiB:end.metrics.JSHeapUsedSize/1024/1024,jsHeapAllocatedMiB:end.metrics.JSHeapTotalSize/1024/1024,rendererTaskCpuPercent:(end.metrics.TaskDuration-start.metrics.TaskDuration)/wall*100,jsScriptCpuPercent:(end.metrics.ScriptDuration-start.metrics.ScriptDuration)/wall*100,rafFps:frameData.intervals.length/wall,frameMedianMs:intervals[Math.floor(intervals.length*.5)],frameP95Ms:intervals[Math.floor(intervals.length*.95)],render:before?.render,memoryCounts:before?.memory,bodyMotion:rows.length?{maxUpperArmAngle:Math.max(...rows.map(r=>angle(first.upperArm,r.upperArm))),maxIndexFingerAngle:Math.max(...rows.map(r=>angle(first.finger,r.finger))),smileMin:Math.min(...rows.map(r=>r.smile)),smileMax:Math.max(...rows.map(r=>r.smile))}:null};
  console.log(JSON.stringify(result));return result;
 }
 const results=[];results.push(await stage('blank browser',4));
 await page.goto('http://127.0.0.1:5173/room.html');await page.waitForFunction(()=>window.lofiRoom?.ready());await page.waitForTimeout(3000);
 results.push(await stage('visible idle, golden hour',10));
 await page.evaluate(()=>{lofiRoom.greet('smile');lofiRoom.greet('thumbsUp');});
 results.push(await stage('smile then thumbs-up, golden hour',9));
 await page.locator('#pause-room').click();results.push(await stage('paused, golden hour',8));
 await page.locator('#mood').selectOption('baseline',{force:true});results.push(await stage('paused, original lighting without bloom',8));
 const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();
 results.push(await stage('second tab foreground (verify visibility)',5));
 const report={recordedAt:new Date().toISOString(),browser:await browser.version(),hardware:{chip:execFileSync('/usr/sbin/sysctl',['-n','machdep.cpu.brand_string'],{encoding:'utf8'}).trim(),logicalCores:Number(execFileSync('/usr/sbin/sysctl',['-n','hw.logicalcpu'],{encoding:'utf8'})),physicalMemoryGiB:Number(execFileSync('/usr/sbin/sysctl',['-n','hw.memsize'],{encoding:'utf8'}))/1024**3},gpu:info.gpu.devices,viewport:{width:1440,height:1050,deviceScaleFactor:2,rendererPixelRatioCap:1.5},errors,results,notes:['Headless Chrome on this Mac, not the actual Codex embedded-browser process.','Sum of RSS can double-count shared memory; not an exact per-tab footprint.','GPU-process CPU time is CPU work, not GPU utilization.','JS heap is only one part of memory; decoded assets/native/GPU allocation are additional.','Snapshot sampling adds small diagnostic overhead.']};
 await fs.writeFile(output,JSON.stringify(report,null,2));
}finally{await browser.close();}
