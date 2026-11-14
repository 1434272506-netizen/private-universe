import {createCircuit,LIF} from './drosophila-circuit.js';
// Main-thread bounded slices are the baseline: no worker or Python service required.
// Six 1ms simulation steps per visual frame; intentionally slower than wall-clock biology.
export function createLIFSolver(count=80){
 const circuit=createCircuit(),groups=circuit.groups,n=circuit.offsets.length-1,size=n*count;
 const offsets=circuit.offsets,targets=circuit.targets,weights=circuit.weights;
 const voltage=new Float32Array(size).fill(-52),current=new Float32Array(size),refractory=new Float32Array(size),rate=new Float32Array(size),input=new Float32Array(size),spikes=new Uint8Array(size);
 const groupBounds=Object.fromEntries(Object.entries(groups).map(([name,g])=>[name,[g.start,g.start+g.count]]));
 const readouts=Array.from({length:count},()=>({turnDrive:0,thrustDrive:0,hoverBrake:0,flashLevel:0,DNa02_L:0,DNa02_R:0,LC10_L:0,LC10_R:0,ORN_L:0,ORN_R:0,compass:0}));
 let seed=12047,steps=0,totalSpikes=0,lastSubsteps=6;
 function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
 function drive(fly,name,value){
  const [start,end]=groupBounds[name],base=fly*n;
  for(let j=base+start;j<base+end;j++)input[j]=value;
 }
 function mean(fly,name){
  const [start,end]=groupBounds[name],base=fly*n;let sum=0;
  for(let j=base+start;j<base+end;j++)sum+=rate[j];
  return sum/(end-start);
 }
 function step(substeps=6){
  lastSubsteps=substeps;
  for(let t=0;t<substeps;t++){
   for(let j=0;j<size;j++){
    rate[j]*=.98019867;current[j]*=.81873075;spikes[j]=0;
    if(refractory[j]>0){refractory[j]-=1;continue;}
    const noise=random()<.008?8:0; // Poisson background events, 8 Hz per neuron.
    voltage[j]+=(LIF.V_rest-voltage[j]+current[j]+input[j]+noise)/20;
    if(voltage[j]>=-45){voltage[j]=-52;refractory[j]=2.2;rate[j]+=20;spikes[j]=1;totalSpikes++;}
   }
   for(let f=0;f<count;f++){
    const base=f*n;
    for(let pre=0;pre<n;pre++)if(spikes[base+pre]){
     for(let e=offsets[pre],end=offsets[pre+1];e<end;e++)current[base+targets[e]]+=weights[e];
    }
   }
   steps++;
  }
  for(let f=0;f<count;f++){
   const o=readouts[f];o.DNa02_L=mean(f,'DNa02_L');o.DNa02_R=mean(f,'DNa02_R');
   o.LC10_L=mean(f,'LC10_L');o.LC10_R=mean(f,'LC10_R');o.ORN_L=mean(f,'ORN_L');o.ORN_R=mean(f,'ORN_R');
   o.turnDrive=Math.tanh((o.DNa02_L-o.DNa02_R)/30);
   o.thrustDrive=Math.min(1,(mean(f,'DNa01_L')+mean(f,'DNa01_R')+mean(f,'DNp01'))/150);
   o.hoverBrake=Math.min(1,(mean(f,'MBON_L')+mean(f,'MBON_R'))/180);
   o.compass=mean(f,'E-PG');
   // Fast luciferin ignition and gentle bioluminescent afterglow driven by Bioluminescence spikes.
   const target=Math.min(1,mean(f,'Bioluminescence')/48);
   o.flashLevel+=(target-o.flashLevel)*(target>o.flashLevel?.42:.035);
  }
 }
 const [epgStart,epgEnd]=groupBounds['E-PG'];
 function driveCompass(fly,heading,active){
  const base=fly*n+epgStart,len=epgEnd-epgStart;
  if(!active){for(let k=0;k<len;k++)input[base+k]=0;return;}
  for(let k=0;k<len;k++){const column=k%8;input[base+k]=7+7*Math.max(0,Math.cos(heading-column*Math.PI/4));}
 }
 return {circuit,readouts,drive,driveCompass,step,voltage,current,rate,get stats(){return {steps,totalSpikes,backend:'main-thread-bounded',substeps:lastSubsteps,simulatedMilliseconds:steps};}};
}
