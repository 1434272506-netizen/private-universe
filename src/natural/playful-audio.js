// Original, offline-safe score: a small bell-and-piano waltz, rendered only on demand.
export function cabinWaltz(){
 const rate=22050,duration=24,samples=rate*duration,data=new Float32Array(samples),beat=.5;
 const melody=[64,67,71,67,66,69,72,69,64,67,74,71,62,66,69,66,60,64,67,71,62,66,69,74,64,67,71,69,67,66,64,59];
 function note(midi,start,length,gain){
  const frequency=440*2**((midi-69)/12),offset=Math.floor(start*rate),count=Math.min(Math.floor(length*rate),samples-offset);
  for(let i=0;i<count;i++){const t=i/rate,env=Math.min(1,t/.014)*Math.exp(-t*3.4/length)*Math.min(1,(length-t)/.12);data[offset+i]+=gain*env*(Math.sin(2*Math.PI*frequency*t)+.23*Math.sin(4*Math.PI*frequency*t));}
 }
 for(let i=0;i<48;i++)note(melody[i%melody.length],.3+i*beat,1.2,.11);
 for(let bar=0;bar<16;bar++){const root=[48,53,45,55][bar%4],t=bar*1.5;note(root,t,1.25,.055);note(root+7,t+.5,.85,.035);note(root+12,t+1,.85,.03);}
 const buffer=new ArrayBuffer(44+samples*2),view=new DataView(buffer),ascii=(at,text)=>[...text].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));
 ascii(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);ascii(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,samples*2,true);
 for(let i=0;i<samples;i++){const fade=Math.min(1,i/(rate*.2),(samples-i)/(rate*2));view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,data[i]*fade)) * 32767),true);}
 return {name:'绿与紫 · 木屋小圆舞曲（原创）',blob:new Blob([buffer],{type:'audio/wav'}),duration};
}

export function playfulSound(audio,kind){
 void audio.chimeOutput().then(output=>{
  if(!output)return;const {context,bus,volume}=output,t=context.currentTime;
  const voice=(start,duration,from,to,gain,type='sine')=>{
   const oscillator=context.createOscillator(),envelope=context.createGain();oscillator.type=type;
   oscillator.frequency.setValueAtTime(from,start);oscillator.frequency.exponentialRampToValueAtTime(to,start+duration);
   envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(gain*volume,start+.018);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
   oscillator.connect(envelope);envelope.connect(bus);oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};oscillator.start(start);oscillator.stop(start+duration+.01);
  };
  if(kind==='piglet')voice(t,.28,260,660,.10);
  else if(kind==='launch'){voice(t,.55,180,1150,.025);voice(t+.12,.48,230,1450,.012);}
  else if(kind==='bloom'){
    // Warm pyrotechnic burst thump
    voice(t,.45,95,36,.065,'triangle');
    // Harmonic musical chord chime
    for(const [i,f] of [523.25,659.25,783.99,1046.5,1318.5].entries())voice(t+i*.022,.55,f,f*.60,.022);
    // Delicate sparkling crackles
    for(let k=0;k<4;k++)voice(t+.32+k*.07,.12,1800+k*320,1200+k*180,.008,'sine');
  }
 }).catch(()=>{});
}
