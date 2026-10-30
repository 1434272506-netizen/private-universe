// Called from the shared ego-browser task; does not launch a browser or alter
// the user's ordinary 5173 profile. Use a QA Page on the separate 5174 origin.
export async function reviewSurpriseStore(page,{moduleURL='/src/surprise-store.js'}={}){
  return page.evaluate(async moduleURL=>{
    const store=await import(moduleURL);
    const prefix=`surprise-check-${crypto.randomUUID()}`,ids=[];
    const checks=[];
    const assert=(value,message)=>{if(!value)throw new Error(message);};
    const rejected=async(action,fragment)=>{
      let problem;try{await action();}catch(error){problem=error;}
      assert(problem&&(!fragment||problem.message.includes(fragment)),`Expected rejection: ${fragment||''}`);
    };
    const check=async(name,action)=>{await action();checks.push(name);};
    const value={type:'note',title:'自动检查纸条',body:'自动检查内容，仅在 QA 浏览器中。',answer:'',color:'#b8a9c7',identity:'purple',position:{x:1,z:1}};
    let note,question,completion;
    try{
      await check('First real save succeeds with empty bookmark and note metadata',async()=>{
        note=await store.saveSurprise(value);ids.push(note.id);
        assert(note.status==='active'&&note.body===value.body,'First note was not committed');
        assert(note.bookmarks.purple===false&&note.notes.green==='','New note metadata was not empty');
      });
      await check('Active editing keeps identity, position and created time while loading persisted records',async()=>{
        const changed=await store.saveSurprise({...value,id:note.id,title:'自动检查修改',position:{x:2,z:1.5}});
        assert(changed.id===note.id&&changed.createdAt===note.createdAt,'Edit rewrote record identity');
        const saved=(await store.loadSurprises()).find(item=>item.id===note.id);
        assert(saved.title==='自动检查修改'&&saved.position.x===2,'Edited note was not persisted');
      });
      await check('Question answer and color are stored as real user fields',async()=>{
        question=await store.saveSurprise({...value,type:'question',title:'自动检查问题',body:'自动检查：答案是什么？',answer:'自动检查答案',color:'#8cab7c',identity:'green'});ids.push(question.id);
        const saved=(await store.loadSurprises()).find(item=>item.id===question.id);
        assert(saved.answer==='自动检查答案'&&saved.identity==='green','Question data was lost');
      });
      await check('Completion commits once and a repeated completion never creates a second archive',async()=>{
        completion=await store.completeSurprise(note.id);const again=await store.completeSurprise(note.id);
        assert(completion.changed===true&&again.changed===false,'Repeated completion was not idempotent');
        assert(again.record.completedAt===completion.record.completedAt,'Repeated completion rewrote original completion');
        assert((await store.loadSurprises()).filter(item=>item.id===note.id).length===1,'Completion duplicated content');
      });
      await check('Archived original content is protected from active edits and removal',async()=>{
        await rejected(()=>store.saveSurprise({...value,id:note.id}),'收进档案');
        await rejected(()=>store.deleteSurprise(note.id),'收进档案');
        assert((await store.loadSurprises()).some(item=>item.id===note.id&&item.status==='archived'),'Archive was removed');
      });
      await check('Purple and green bookmarks and marginal notes remain independent',async()=>{
        await store.decorateArchive(note.id,{identity:'purple',bookmark:true,note:'自动检查紫色便签'});
        await store.decorateArchive(note.id,{identity:'green',bookmark:true,note:'自动检查绿色便签'});
        await store.decorateArchive(note.id,{identity:'purple',bookmark:false});
        const saved=(await store.loadSurprises()).find(item=>item.id===note.id);
        assert(saved.bookmarks.purple===false&&saved.bookmarks.green===true,'Bookmark ownership was overwritten');
        assert(saved.notes.purple==='自动检查紫色便签'&&saved.notes.green==='自动检查绿色便签','Marginal notes were lost');
        assert(saved.body===value.body,'Bookmark or note changed original content');
      });
      await check('Archive open marker persists without rewriting the completed content',async()=>{
        const first=await store.markArchiveSeen(note.id),again=await store.markArchiveSeen(note.id);
        assert(first.archiveSeenAt>0&&again.archiveSeenAt===first.archiveSeenAt,'Archive reading state was not stable');
        assert(again.completedAt===completion.record.completedAt&&again.body===value.body,'Archive reading rewrote content');
      });
      await check('Backup restore is validated before any write and repeated restore does not overwrite edits',async()=>{
        const first=(await store.loadSurprises()).find(item=>item.id===note.id);
        const copy={...first,id:`${prefix}-restored`};ids.push(copy.id);
        const backup=records=>new Blob([JSON.stringify({format:'private-universe-surprises',version:1,records})],{type:'application/json'});
        assert(await store.restoreSurprisesBackup(backup([copy]))===1,'Valid backup did not restore');
        await store.decorateArchive(copy.id,{identity:'green',note:'自动检查恢复后修改'});
        assert(await store.restoreSurprisesBackup(backup([copy]))===0,'Repeated backup duplicated records');
        assert((await store.loadSurprises()).find(item=>item.id===copy.id).notes.green==='自动检查恢复后修改','Backup overwrote newer note');
        const partial={...copy,id:`${prefix}-partial`};ids.push(partial.id);
        await rejected(()=>store.restoreSurprisesBackup(backup([partial,{...copy,id:`${prefix}-invalid`,position:{x:99,z:99}}])),'位置');
        assert(!(await store.loadSurprises()).some(item=>item.id===partial.id),'Invalid backup partially committed');
        await rejected(()=>store.restoreSurprisesBackup(backup([{...partial,notes:[]}])),'便签格式');
        await rejected(()=>store.restoreSurprisesBackup(backup([partial,partial])),'重复');
      });
      await check('Only the active surprise can be explicitly removed',async()=>{
        await store.deleteSurprise(question.id);
        assert(!(await store.loadSurprises()).some(item=>item.id===question.id),'Active note was not removed');
        assert((await store.loadSurprises()).some(item=>item.id===note.id),'Active removal affected archived content');
      });
      return {checks,errors:[],isolatedQaOrigin:location.origin};
    }finally{
      // Remove only the exact IDs created above, including archived fixtures that
      // are deliberately protected by the product's normal active-item API.
      await new Promise((resolve,reject)=>{
        const request=indexedDB.open('private-universe-surprises',1);
        request.onerror=()=>reject(request.error);request.onsuccess=()=>{
          const database=request.result,transaction=database.transaction('surprises','readwrite');
          for(const id of ids)transaction.objectStore('surprises').delete(id);
          transaction.oncomplete=()=>{database.close();resolve();};transaction.onabort=()=>{database.close();reject(transaction.error);};
        };
      });
    }
  },moduleURL);
}

export async function reviewSurpriseWorld(){
  const THREE=await import('three');
  const {createSurpriseWorld}=await import('../src/natural/surprises.js');
  const parent=new THREE.Group(),clock={value:0};let reduced=false;
  const world=createSurpriseWorld(parent,clock,{ground:()=>.5,reducedMotion:()=>reduced});
  const record={id:'world-check',status:'active',color:'#b8a9c7',position:{x:1,z:1}};
  const checks=[],assert=(value,message)=>{if(!value)throw new Error(message);};
  try{
    world.sync([record]);world.update(1);
    assert(world.objects.length===1&&world.objects[0].userData.interaction==='surprise:world-check','Real balloon was not pickable');
    assert(Math.abs(world.objects[0].position.y-2.5)<.1,'Balloon did not sit above the actual ground');checks.push('Saved surprise creates a correctly placed pickable 3D balloon');
    world.sync([{...record,status:'archived'}],{type:'complete',id:record.id});
    assert(world.flying&&world.objects.length===0,'Completed balloon stayed interactive');
    world.update(2);world.sync([{...record,status:'archived'}],{type:'complete',id:record.id});world.update(4.3);
    assert(!world.flying&&world.objects.length===0,'Fly-away never completed');checks.push('Explicit completion flies away once and removes the interactive balloon');
    world.sync([{...record,status:'archived'}]);assert(world.objects.length===0,'Archive regenerated a floating balloon');checks.push('Reopening an archive never recreates the balloon');
    reduced=true;world.sync([record]);world.sync([{...record,status:'archived'}],{type:'complete',id:record.id});
    assert(!world.flying&&world.objects.length===0,'Reduced motion unexpectedly played a fly-away');checks.push('Reduced motion removes a completed balloon without an ascent animation');
    return {checks,errors:[]};
  }finally{world.dispose();assert(parent.children.length===0,'World disposal leaked a group');}
}

if(typeof process!=='undefined'&&process.argv[1]){
  const {pathToFileURL}=await import('node:url');
  if(pathToFileURL(process.argv[1]).href===import.meta.url){
    const result=await reviewSurpriseWorld();
    for(const name of result.checks)console.log('PASS',name);
    console.log('The separate shared ego-browser task must run reviewSurpriseStore(page) and the full user flow.');
  }
}
