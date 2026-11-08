import * as THREE from 'three';

export function celestial(time){
  const positions=[],sizes=[],phases=[],speeds=[];
  for(const [count,size] of [[72,4.8],[320,2.8],[950,1.6]]){
    for(let i=0;i<count;i++){
      // From the floating island, open sky continues below eye level to the cloud deck.
      const y=Math.random()*1.32-.32, angle=Math.random()*Math.PI*2, r=Math.sqrt(1-y*y);
      positions.push(230*r*Math.cos(angle),230*y,230*r*Math.sin(angle));
      sizes.push(size);
      phases.push(Math.random()*2*Math.PI);
      speeds.push(.7+Math.random()*2.3);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  for(const [name,data] of [['size',sizes],['aPhase',phases],['aTwinkleSpeed',speeds]]){
    geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,1));
  }
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uTime:time,opacity:{value:0}},
    vertexShader:`attribute float size,aPhase,aTwinkleSpeed;
      uniform float uTime;
      varying float tier,twinkle;
      void main(){
        tier=size;
        twinkle=.55+.45*sin(uTime*aTwinkleSpeed+aPhase);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        gl_PointSize=size;
      }`,
    fragmentShader:`uniform float opacity; varying float tier,twinkle;
      void main(){
        vec2 p=abs(gl_PointCoord*2.-1.);
        float core=exp(-3.5*dot(p,p));
        vec3 tint=tier>4.?vec3(1.6,1.8,2.2):tier>2.?vec3(1.2,1.4,1.8):vec3(.85,.95,1.2);
        float rays=step(4.,tier)*exp(-8.*min(p.x,p.y))*(1.-max(p.x,p.y));
        gl_FragColor=vec4(tint,opacity*twinkle*min(1.,core+rays));
      }`
  });
  const stars=new THREE.Points(geometry,material);
  stars.name='star-dome'; stars.renderOrder=-15; stars.visible=false;
  return stars;
}
