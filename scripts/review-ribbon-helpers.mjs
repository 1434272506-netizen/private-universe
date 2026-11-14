// All album entry checks click the actual garden canvas. Development hooks
// only aim/project the view; production finds the same ribbon via real hover.
export async function clickTreeRibbon(page){
 const point=await page.evaluate(()=>{
  const p=window.__PU;if(!p)return null;
  p.frame('hero');p.camera.updateMatrixWorld(true);p.scene.updateMatrixWorld(true);
  const v=p.anchors.ribbon.clone().project(p.camera);return [(1+v.x)*innerWidth/2,(1-v.y)*innerHeight/2];
 });
 if(point){
  await page.mouse.move(...point);
  await page.waitForFunction(()=>document.querySelector('#app > canvas').dataset.hover==='ribbon',null,{timeout:5000});
  await page.mouse.click(...point);
 }else{
  await page.locator('#reset').click();
  const {width,height}=page.viewportSize(),candidates=[[width*.4,height*.43]];
  // The complete canopy fits in this broad overview area on either aspect.
  // A 32px grid covers the existing 28px ribbon reach target without adding UI.
  for(let y=height*.22;y<height*.68;y+=32)for(let x=width*.12;x<width*.72;x+=32)candidates.push([x,y]);
  let hit=false;
  for(const candidate of candidates){
   await page.mouse.move(...candidate);await page.waitForTimeout(42);
   if(await page.locator('#app > canvas').getAttribute('data-hover')==='ribbon'){await page.mouse.click(...candidate);hit=true;break;}
  }
  if(!hit)throw new Error('No visible 3D ribbon found in the production overview');
 }
 await page.locator('#memory-dialog[open]').waitFor();
}
