import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {preview} from 'vite';
import * as THREE from 'three';
import {getCabinView} from '../src/natural/cabin-view.js';
import {CABIN_SITE,ground} from '../src/natural/land.js';

const out='work/qa/playful';await mkdir(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:0,open:false}}),errors=[],pageerrors=[];
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});let failure;
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>pageerrors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);await page.locator('#enter-direct').click({timeout:90000});await page.locator('#invitation').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>typeof window.__PU),'undefined');
 await page.locator('#help-toggle').click();await page.locator('[data-place="cabin"]').click();await page.waitForTimeout(2100);
 const view=getCabinView(1280/800),camera=new THREE.PerspectiveCamera(34,1280/800,.15,900);camera.position.fromArray(view.position);camera.lookAt(new THREE.Vector3(...view.target));camera.updateMatrixWorld(true);
 const cabinMatrix=new THREE.Matrix4().compose(new THREE.Vector3(CABIN_SITE.x,ground(CABIN_SITE.x,CABIN_SITE.z),CABIN_SITE.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),CABIN_SITE.yaw),new THREE.Vector3(1,1,1));
 const pig=new THREE.Vector3(1.28,.945,.405).applyMatrix4(cabinMatrix).project(camera),point=[(pig.x+1)*640,(1-pig.y)*400];
 // The camera limits travel per frame; wait for genuine hover feedback instead of a fixed animation delay.
 let ready=false;for(let i=0;i<150;i++){await page.mouse.move(point[0]+i%2,point[1]);ready=await page.evaluate(()=>document.querySelector('#app > canvas').dataset.hover==='piglet-pat');if(ready)break;await page.waitForTimeout(100);}assert.ok(ready,'Production cabin must expose the real piglet target after arrival');
 await page.mouse.click(...point);await page.waitForFunction(()=>document.querySelector('#announcement').textContent.includes('小猪软软弹'));await page.screenshot({path:`${out}/production-piglet-pat.png`});
 await page.locator('#reset').click();await page.waitForTimeout(1700);await page.locator('[data-atmo="night"]').click();await page.locator('#launch-fireworks').waitFor({state:'visible'});await page.waitForTimeout(1600);await page.locator('#launch-fireworks').click();await page.waitForFunction(()=>document.querySelector('#announcement').textContent.includes('把绿与紫'));await page.waitForTimeout(1700);await page.screenshot({path:`${out}/production-night-fireworks.png`});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/production-mobile-night.png`});assert.deepEqual(errors,[]);assert.deepEqual(pageerrors,[]);
 console.log('PASS production preview: no development hooks; real window pig click, night fireworks, 390x844 HUD; console.error=0, pageerror=0');
}catch(error){failure=error;console.error(error);}
finally{await browser.close();await server.close();await writeFile(`${out}/production-result.json`,JSON.stringify({pass:!failure,consoleErrors:errors,pageerrors,error:failure?.stack},null,2));}
if(failure)process.exitCode=1;
