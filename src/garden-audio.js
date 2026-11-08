import './garden-audio.css';

const DATABASE='private-universe-audio',PREFERENCES='private-universe-sound-preferences';
const MUSIC_LIMIT=50*1024*1024;
const defaults={natureVolume:.6,musicVolume:.38,muted:false};
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
const make=(tag,className,text)=>{
  const element=document.createElement(tag);if(className)element.className=className;
  if(text!=null)element.textContent=text;return element;
};
function storageError(error){
  if(error?.name==='QuotaExceededError')return new Error('浏览器空间不足，音乐还没有保存。请先腾出一些空间再试。');
  return new Error('浏览器暂时无法保存音乐，请检查本机存储设置后重试。');
}
let databasePromise;
function database(){
  if(databasePromise)return databasePromise;
  databasePromise=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('这个浏览器不支持保存本机音乐。'));return;}
    const request=indexedDB.open(DATABASE,1);let abandoned=false;
    request.onupgradeneeded=()=>request.result.createObjectStore('tracks',{keyPath:'id'});
    request.onblocked=()=>{abandoned=true;reject(new Error('另一个花园页面正在使用音乐存储，请关闭它再试。'));};
    request.onerror=()=>reject(storageError(request.error));
    request.onsuccess=()=>{
      const result=request.result;if(abandoned){result.close();return;}
      result.onversionchange=()=>{result.close();databasePromise=null;};
      result.onclose=()=>{databasePromise=null;};resolve(result);
    };
  }).catch(error=>{databasePromise=null;throw error;});
  return databasePromise;
}
async function storedMusic(operation,record){
  const connection=await database();
  return new Promise((resolve,reject)=>{
    let result,transaction;
    try{
      transaction=connection.transaction('tracks',operation==='read'?'readonly':'readwrite');
      const store=transaction.objectStore('tracks');
      if(operation==='read'){const request=store.get('personal');request.onsuccess=()=>{result=request.result;};}
      else if(operation==='write')store.put({...record,id:'personal'});else store.delete('personal');
    }catch(error){reject(storageError(error));return;}
    transaction.oncomplete=()=>resolve(result);
    transaction.onabort=()=>reject(storageError(transaction.error));transaction.onerror=()=>{};
  });
}

export function prepareGardenAudio({onOpen=()=>{},onClose=()=>{}}={}){
  const existing=document.querySelector('#sound-dialog');
  if(existing)throw new Error('花园声音面板已经准备好了。');
  const lifetime=new AbortController(),signal=lifetime.signal;
  let preferences={...defaults};
  try{
    const saved=JSON.parse(localStorage.getItem(PREFERENCES)||'null');
    if(saved&&typeof saved==='object')preferences={natureVolume:clamp(saved.natureVolume??defaults.natureVolume),musicVolume:clamp(saved.musicVolume??defaults.musicVolume),muted:saved.muted===true};
  }catch{/* Start quietly when preferences are unavailable or malformed. */}
  let context=null,master=null,natureBus=null,musicBus=null,musicNode=null,natureGraph=null;
  let naturePlaying=false,natureStarting=false,musicStarting=false,track=null,musicURL=null,busy=false,disposed=false,returnFocus=null;
  let natureRequest=0,musicRequest=0;
  let fadeTimer=null,idleTimer=null,audioGeneration=0;
  const player=new Audio();player.preload='metadata';player.loop=true;
  const entry=make('button','quiet-button sound-entry','听听花园');entry.id='garden-sound';entry.type='button';
  entry.setAttribute('aria-haspopup','dialog');entry.setAttribute('aria-controls','sound-dialog');
  const panel=document.querySelector('#help-panel'),replay=document.querySelector('#replay');panel.insertBefore(entry,replay);
  const dialog=make('dialog','sound-dialog');dialog.id='sound-dialog';dialog.setAttribute('aria-labelledby','sound-title');
  dialog.innerHTML=`<section class="sound-surface">
    <button type="button" class="sound-close icon-button" aria-label="收起花园声音"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    <header class="sound-heading"><span class="tiny-label">LISTEN TO THE AFTERNOON</span><h2 id="sound-title">听一会儿，春天。</h2><p>让风和溪水作伴，也可以放一首自己的歌。</p></header>
    <section class="sound-section" aria-labelledby="nature-title"><div class="sound-section-heading"><div><h3 id="nature-title">花园里的声音</h3><p>风、叶间细响和溪流，轻轻铺在身边。</p></div><button id="nature-play" class="sound-control" type="button" aria-pressed="false">听听自然声</button></div><label class="sound-volume"><span>自然声的音量</span><input id="nature-volume" type="range" min="0" max="100" step="1"><output id="nature-volume-label"></output></label></section>
    <section class="sound-section" aria-labelledby="music-title"><div class="sound-section-heading"><div><h3 id="music-title">自己的音乐</h3><p id="music-name">还没有放入音乐</p></div><button id="music-play" class="sound-control" type="button" disabled>播放音乐</button></div><label class="sound-file"><span>选一首本机音乐</span><input id="music-file" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"><small>MP3、WAV、OGG、M4A 等浏览器支持的音频，最多 50 MB。</small></label><label class="sound-volume"><span>音乐的音量</span><input id="music-volume" type="range" min="0" max="100" step="1"><output id="music-volume-label"></output></label><button id="music-remove" class="quiet-button sound-remove" type="button" hidden>移除这首音乐</button></section>
    <footer class="sound-footer"><button id="sound-mute" class="sound-control sound-mute" type="button" aria-pressed="false">全部静音</button><p>音乐只保存在当前设备、浏览器和网址下。启封信笺时，风声与已收藏的音乐会轻轻响起；离开页面会暂停。</p></footer>
    <p id="sound-feedback" class="sound-feedback" role="status" aria-live="polite"></p>
  </section>`;
  document.querySelector('#app').append(dialog);
  const $=selector=>dialog.querySelector(selector);
  const natureButton=$('#nature-play'),musicButton=$('#music-play'),muteButton=$('#sound-mute');
  const tell=(message,error=false)=>{const target=$('#sound-feedback');target.textContent=message;target.dataset.error=String(error);};
  function savePreferences(){
    try{localStorage.setItem(PREFERENCES,JSON.stringify(preferences));}
    catch{tell('音量已调整，但浏览器未能记住偏好。下次可能需要重新设置。',true);}
  }
  function update(){
    natureButton.textContent=natureStarting?'正在打开…':naturePlaying?'暂停自然声':'听听自然声';natureButton.disabled=natureStarting;natureButton.setAttribute('aria-pressed',String(naturePlaying));
    musicButton.disabled=!track||busy||musicStarting;musicButton.textContent=musicStarting?'正在播放…':player.paused?'播放音乐':'暂停音乐';musicButton.setAttribute('aria-pressed',String(!player.paused));
    muteButton.textContent=preferences.muted?'取消静音':'全部静音';muteButton.setAttribute('aria-pressed',String(preferences.muted));
    $('#music-name').textContent=track?.name||'还没有放入音乐';$('#music-remove').hidden=!track;
    $('#music-remove').disabled=busy;$('#music-file').disabled=busy;
    for(const kind of ['nature','music']){
      const percent=Math.round(preferences[kind+'Volume']*100);$('#'+kind+'-volume').value=String(percent);$('#'+kind+'-volume-label').textContent=`${percent}%`;
    }
    dialog.dataset.naturePlaying=String(naturePlaying);dialog.dataset.musicPlaying=String(!player.paused);
    dialog.dataset.audioState=context?.state||'not-started';dialog.dataset.muted=String(preferences.muted);dialog.setAttribute('aria-busy',String(busy));
    entry.dataset.playing=String(naturePlaying||!player.paused);
  }
  function ramp(parameter,value,duration=.18){
    if(!context)return;const now=context.currentTime;parameter.cancelScheduledValues(now);parameter.setValueAtTime(parameter.value,now);parameter.linearRampToValueAtTime(value,now+duration);
  }
  async function unlock(){
    if(disposed)throw new Error('声音面板已经关闭，请重新打开花园。');
    clearTimeout(idleTimer);
    const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!AudioContext)throw new Error('这个浏览器暂时不支持花园声音，请使用较新的浏览器。');
    if(!context){
      context=new AudioContext({latencyHint:'playback'});master=context.createGain();natureBus=context.createGain();musicBus=context.createGain();
      master.gain.value=preferences.muted?0:.72;natureBus.gain.value=0;musicBus.gain.value=preferences.musicVolume;
      natureBus.connect(master);musicBus.connect(master);master.connect(context.destination);
      context.addEventListener('statechange',()=>{if(!disposed)update();},{signal});
    }
    if(context.state!=='running')await context.resume();
    if(context.state!=='running')throw new Error('浏览器还没有允许播放，请再点一次声音按钮。');
    ramp(master.gain,preferences.muted?0:.72);update();return context;
  }
  function makeNature(){
    if(natureGraph)return;
    const buffer=context.createBuffer(2,context.sampleRate*9,context.sampleRate);
    for(let channel=0;channel<2;channel++){
      const values=buffer.getChannelData(channel);for(let i=0;i<values.length;i++)values[i]=(Math.random()*2-1)*.65;
    }
    const nodes=[],sources=[];
    const layer=(frequency,type,gain,offset)=>{
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),volume=context.createGain();
      source.buffer=buffer;source.loop=true;filter.type=type;filter.frequency.value=frequency;filter.Q.value=.5;volume.gain.value=gain;
      source.connect(filter);filter.connect(volume);volume.connect(natureBus);source.start(0,offset);sources.push(source);nodes.push(filter,volume);return volume;
    };
    layer(340,'lowpass',.58,0); // Wind, kept below the sharp upper frequencies.
    layer(1450,'bandpass',.075,2.3); // Soft continuous water texture.
    const leaves=layer(2600,'bandpass',.028,5.7),swell=context.createOscillator(),depth=context.createGain();
    swell.frequency.value=.13;depth.gain.value=.018;swell.connect(depth);depth.connect(leaves.gain);swell.start();sources.push(swell);nodes.push(depth);
    natureGraph={sources,nodes};
  }
  function releaseNature(){
    if(!natureGraph)return;
    for(const source of natureGraph.sources){try{source.stop();}catch{}source.disconnect();}
    for(const node of natureGraph.nodes)node.disconnect();natureGraph=null;
  }
  function idleSoon(){
    clearTimeout(idleTimer);idleTimer=setTimeout(()=>{
      if(!disposed&&!naturePlaying&&player.paused&&context?.state==='running')context.suspend().catch(()=>{});
    },250);
  }
  function pauseNature(){
    const wasPlaying=naturePlaying||natureStarting;
    natureRequest++;natureStarting=false;naturePlaying=false;if(natureBus)ramp(natureBus.gain,0);clearTimeout(fadeTimer);
    fadeTimer=setTimeout(()=>{if(!naturePlaying)releaseNature();},220);idleSoon();update();if(wasPlaying)tell('自然声已暂停。');
  }
  async function toggleNature(){
    if(naturePlaying||natureStarting){pauseNature();return;}
    const request=++natureRequest;natureStarting=true;update();
    try{
      await unlock();
      if(request!==natureRequest||disposed||document.hidden){idleSoon();return;}
      clearTimeout(fadeTimer);makeNature();naturePlaying=true;ramp(natureBus.gain,preferences.natureVolume);
      tell(preferences.muted?'自然声已开启，当前仍为静音。':'自然声已轻轻打开。');
    }catch(error){if(!disposed&&request===natureRequest)tell(error.message||'自然声暂时没有打开，请再试一次。',true);}
    finally{if(!disposed&&request===natureRequest){natureStarting=false;update();}}
  }
  function pauseMusic(){
    const wasPlaying=musicStarting||!player.paused;
    musicRequest++;musicStarting=false;player.pause();idleSoon();update();if(wasPlaying)tell('音乐已暂停。');
  }
  async function toggleMusic(){
    if(!track||busy)return;
    if(!player.paused||musicStarting){pauseMusic();return;}
    const generation=audioGeneration,request=++musicRequest;musicStarting=true;update();
    try{
      await unlock();
      if(generation!==audioGeneration||request!==musicRequest||disposed||document.hidden){idleSoon();return;}
      ramp(musicBus.gain,preferences.musicVolume);
      if(!musicNode){musicNode=context.createMediaElementSource(player);musicNode.connect(musicBus);}
      await player.play();
      if(disposed||document.hidden){player.pause();idleSoon();return;}
      if(request===musicRequest)tell(preferences.muted?'音乐已播放，当前仍为静音。':'音乐正在这里播放。');
    }catch(error){if(!disposed&&request===musicRequest)tell(error.name==='NotAllowedError'?'浏览器还没有允许播放，请再点一次「播放音乐」。':'这首音乐暂时未能播放，请重新选择浏览器支持的音频。',true);}
    finally{if(!disposed&&request===musicRequest){musicStarting=false;update();}}
  }
  function setTrack(record){
    audioGeneration++;musicRequest++;musicStarting=false;player.pause();player.removeAttribute('src');player.load();
    if(musicURL){URL.revokeObjectURL(musicURL);musicURL=null;}
    track=record||null;if(track){musicURL=URL.createObjectURL(track.blob);player.src=musicURL;player.load();}
    idleSoon();update();
  }
  async function chooseMusic(file){
    if(!file)return;
    if(!file.size||file.size>MUSIC_LIMIT){tell('请选择不超过 50 MB 的音频文件。',true);return;}
    if(!file.type.startsWith('audio/')&&!/\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(file.name)){tell('请选择 MP3、WAV、OGG、M4A 等音频文件。',true);return;}
    busy=true;update();tell('正在收好这首音乐…');
    try{
      const OfflineContext=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
      if(!OfflineContext)throw new Error('这个浏览器暂时不能检查音频格式，请换用较新的浏览器。');
      const decoder=new OfflineContext(1,1,44100);let decoded;
      try{decoded=await decoder.decodeAudioData(await file.arrayBuffer());}
      catch{throw new Error('这份音频无法读取，或浏览器不支持它的编码。原来的音乐仍保留。');}
      if(!Number.isFinite(decoded.duration)||decoded.duration<=0)throw new Error('这份音频没有可播放的内容。');
      const record={blob:file,name:file.name,duration:decoded.duration,type:file.type};
      await storedMusic('write',record);if(disposed)return;setTrack(record);tell('音乐已保存在这台浏览器里，点「播放音乐」就能听。');
    }catch(error){tell(error.message||'音乐还没有保存，请重试。',true);}
    finally{busy=false;$('#music-file').value='';update();}
  }
  function open(){
    if(dialog.open||disposed)return;returnFocus=document.activeElement;onOpen();dialog.showModal();$('.sound-close').focus({preventScroll:true});
  }
  function close(){if(dialog.open)dialog.close();}
  entry.addEventListener('click',open,{signal});$('.sound-close').addEventListener('click',close,{signal});
  dialog.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();close();},{signal});
  dialog.addEventListener('close',()=>{onClose();(returnFocus?.isConnected&&returnFocus.getClientRects().length?returnFocus:document.querySelector('#help-toggle')).focus({preventScroll:true});},{signal});
  natureButton.addEventListener('click',toggleNature,{signal});musicButton.addEventListener('click',toggleMusic,{signal});
  muteButton.addEventListener('click',()=>{preferences.muted=!preferences.muted;if(master)ramp(master.gain,preferences.muted?0:.72);tell(preferences.muted?'全部声音已静音。':'已取消静音。');savePreferences();update();},{signal});
  for(const kind of ['nature','music'])$('#'+kind+'-volume').addEventListener('input',event=>{
    preferences[kind+'Volume']=clamp(Number(event.target.value)/100);
    if(kind==='nature'&&naturePlaying)ramp(natureBus.gain,preferences.natureVolume);
    if(kind==='music'&&musicBus)ramp(musicBus.gain,preferences.musicVolume);savePreferences();update();
  },{signal});
  $('#music-file').addEventListener('change',event=>chooseMusic(event.target.files[0]),{signal});
  $('#music-remove').addEventListener('click',async()=>{
    if(!track||busy||!confirm('从这台浏览器移除这首音乐？电脑里的原文件不会改变。'))return;
    busy=true;update();try{await storedMusic('remove');setTrack(null);tell('本机音乐已移除，电脑原文件没有改变。');}
    catch(error){tell(error.message,true);}finally{busy=false;update();}
  },{signal});
  player.addEventListener('play',update,{signal});player.addEventListener('pause',update,{signal});
  player.addEventListener('error',()=>{if(track&&!busy){tell('这首音乐暂时无法播放，请重新选择音频。',true);update();}},{signal});
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden||disposed)return;
    const wasPlaying=naturePlaying||natureStarting||musicStarting||!player.paused;pauseNature();pauseMusic();
    if(wasPlaying)tell('离开页面时声音已暂停，想听时再打开。');update();
  },{signal});
  function stop(){pauseNature();pauseMusic();}
  async function startCeremony(){
    // Called directly in the unlocking gesture: create/resume and play before
    // any asynchronous storage or decoding work can consume user activation.
    if(disposed||document.hidden)return;
    const nr=++natureRequest,mr=++musicRequest;
    natureStarting=true;clearTimeout(fadeTimer);
    try{
      const unlocked=unlock();
      let playing=null;
      if(track&&!busy&&context){
        if(!musicNode){musicNode=context.createMediaElementSource(player);musicNode.connect(musicBus);}
        ramp(musicBus.gain,0,0);
        playing=player.play().then(()=>true,()=>false);
      }
      await unlocked;
      if(disposed||document.hidden||nr!==natureRequest){idleSoon();return;}
      makeNature();naturePlaying=true;ramp(natureBus.gain,preferences.natureVolume,1);
      if(playing&&await playing&&mr===musicRequest&&!document.hidden){
        const now=context.currentTime;
        musicBus.gain.cancelScheduledValues(now);musicBus.gain.setValueAtTime(0,now);
        musicBus.gain.setValueAtTime(0,now+1);musicBus.gain.linearRampToValueAtTime(preferences.musicVolume,now+4);
      }
      tell('春风和溪水，轻轻醒来了。');
    }catch{stop();tell('声音暂时未能开启，可以在「听听花园」里再试一次。',true);}
    finally{if(nr===natureRequest)natureStarting=false;update();}
  }
  function getState(){return {naturePlaying,musicPlaying:!player.paused,muted:preferences.muted,natureVolume:preferences.natureVolume,musicVolume:preferences.musicVolume,audioState:context?.state||'not-started',track:track?{name:track.name,bytes:track.blob.size,duration:track.duration}:null};}
  function dispose(){
    if(disposed)return;const wasOpen=dialog.open;if(wasOpen)dialog.close();disposed=true;natureRequest++;musicRequest++;clearTimeout(fadeTimer);clearTimeout(idleTimer);
    player.pause();player.removeAttribute('src');player.load();releaseNature();musicNode?.disconnect();
    if(musicURL)URL.revokeObjectURL(musicURL);context?.close().catch(()=>{});lifetime.abort();entry.remove();dialog.remove();if(wasOpen)onClose();
  }
  const ready=storedMusic('read').then(record=>{
    if(disposed)return;if(record?.blob instanceof Blob&&record.blob.size)setTrack(record);update();
  }).catch(error=>{if(!disposed)tell(error.message||'暂时未能读取本机音乐。',true);});
  update();return {open,close,stop,startCeremony,getState,ready,dispose};
}
