// The rendered ribbon opens into the reading cloth at its actual screen position.
// This is a presentation transition; the garden itself remains a live 3D scene.
export function presentRibbon(dialog,source,{reducedMotion=false}={}){
  const surface=dialog.querySelector('.story-surface');
  dialog.classList.add('has-ribbon-transition');
  const bounds=surface.getBoundingClientRect();
  const x=source.x-(bounds.left+bounds.width/2);
  const y=source.y-(bounds.top+bounds.height/2);
  const folded=`translate(${x}px,${y}px) rotate(-7deg) scale(.018,.14)`;
  const extended=`translate(${x*.18}px,${y*.2}px) rotate(-1deg) scale(1,.075)`;
  const animations=[];
  let closing=false;
  const animate=(element,frames,options)=>{
    const animation=element.animate(frames,options);animations.push(animation);
    return animation;
  };
  if(!reducedMotion){
    const opening=animate(surface,[
      {transform:folded,opacity:0,offset:0},
      {transform:folded,opacity:1,offset:.06},
      {transform:extended,opacity:1,offset:.38},
      {transform:'translate(0,0) rotate(0) scale(1,1)',opacity:1,offset:1},
    ],{duration:1050,easing:'cubic-bezier(.2,.65,.18,1)',fill:'both'});
    for(const element of surface.querySelectorAll('.story-heading,.memory-content,.ribbon-footer')){
      const reveal=animate(element,[{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:440,delay:520,easing:'ease-out',fill:'both'});
      reveal.finished.then(()=>{if(!closing)reveal.cancel();}).catch(()=>{});
    }
    opening.finished.then(()=>{if(!closing)opening.cancel();}).catch(()=>{});
  }
  return {
    async close({immediate=false}={}){
      closing=true;
      const current=getComputedStyle(surface).transform;
      for(const animation of animations)animation.cancel();
      if(reducedMotion||immediate)return;
      const rect=surface.getBoundingClientRect();
      const endX=source.x-(rect.left+rect.width/2),endY=source.y-(rect.top+rect.height/2);
      const endFolded=`translate(${endX}px,${endY}px) rotate(-7deg) scale(.018,.14)`;
      const endExtended=`translate(${endX*.18}px,${endY*.2}px) rotate(-1deg) scale(1,.075)`;
      const collapse=animate(surface,[
        {transform:current==='none'?'scale(1)':current,opacity:1,offset:0},
        {transform:endExtended,opacity:1,offset:.55},
        {transform:endFolded,opacity:0,offset:1},
      ],{duration:480,easing:'cubic-bezier(.5,0,.7,.45)',fill:'both'});
      await collapse.finished.catch(()=>{});
    },
    dispose(){
      for(const animation of animations)animation.cancel();
      dialog.classList.remove('has-ribbon-transition');
    },
  };
}
