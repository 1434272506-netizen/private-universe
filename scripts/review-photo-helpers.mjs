export async function waitForPhotoPage(page,number,total){
  await page.waitForFunction(({number,total})=>{
    const root=document.querySelector('#memory-content');
    if(!root||root.getAttribute('aria-busy')==='true')return false;
    if(root.querySelectorAll('.album-page').length!==1||!root.querySelector('.album-page[data-current="true"]'))return false;
    return number==null||root.querySelector('.story-position')?.textContent===`${number} / ${total}`;
  },{number,total},{timeout:15000});
}

export async function goToPhotoPage(page,number,total){
  await page.keyboard.press('Home');await waitForPhotoPage(page,1,total);
  for(let current=1;current<number;current++){
    await page.locator('.album-next').click();await waitForPhotoPage(page,current+1,total);
  }
}

export const currentPhoto=page=>page.locator('.album-page[data-current="true"] img');
