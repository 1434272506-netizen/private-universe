import {providedPhotoImport} from '../src/personal-content.js';

// Isolated test contexts skip the user's supplied photo batch. This touches no
// daily browser profile, source photo, or deployed production content.
export async function prepareEmptyFixtureCollection(context){
  await context.addInitScript(({importId})=>{
    globalThis.__PU_FIXTURE_STORAGE_READY=new Promise((resolve,reject)=>{
      const request=indexedDB.open('private-universe-content',2);
      request.onupgradeneeded=()=>{
        const database=request.result;
        for(const store of ['memories','letters','imports']){
          if(!database.objectStoreNames.contains(store))database.createObjectStore(store,{keyPath:'id'});
        }
      };
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Fixture storage is blocked'));
      request.onsuccess=()=>{
        const database=request.result;
        const transaction=database.transaction('imports','readwrite');
        transaction.objectStore('imports').put({id:importId});
        transaction.oncomplete=()=>{database.close();resolve(true);};
        transaction.onabort=()=>{database.close();reject(transaction.error);};
      };
    });
    // Surface setup failure to the test runner without an unhandled rejection.
    globalThis.__PU_FIXTURE_STORAGE_READY.catch(error=>{globalThis.__PU_FIXTURE_STORAGE_ERROR=String(error);});
  },{importId:providedPhotoImport.id});
}

export async function waitForContentReady(page){
  await page.waitForFunction(()=>{
    const count=document.querySelector('#memory-count');
    return Boolean(count?.textContent.trim())&&document.querySelector('#content-dialog')?.getAttribute('aria-busy')!=='true';
  },null,{timeout:90000});
}
