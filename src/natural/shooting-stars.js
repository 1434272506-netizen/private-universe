import * as THREE from 'three';

export function meteorGeometry(){
  const length=14;
  const geometry=new THREE.PlaneGeometry(length+.5,.86);
  return geometry.translate(-length/2+.25,0,0);
}

// The ambient meteor and wish shower share the same tapered tail and nucleus.
export function meteorStreak(geometry, tint=new THREE.Color(.66,.82,1)){
  const material=new THREE.ShaderMaterial({
    uniforms:{intensity:{value:0},tint:{value:tint}}, transparent:true,depthWrite:false,
    side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 trail;
      void main(){trail=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float intensity;uniform vec3 tint; varying vec2 trail;
      void main(){
        float y=abs(trail.y-.5)*2.;
        float head=exp(-pow((trail.x-.982)*55.,2.)-y*y*4.);
        float tail=pow(trail.x,1.8)*exp(-y*y*14.);
        gl_FragColor=vec4(mix(tint,vec3(1.4),head),min(1.,tail+head)*intensity);
      }`
  });
  const streak=new THREE.Mesh(geometry,material);
  streak.visible=false; streak.renderOrder=-14;
  return streak;
}

export function shootingStars(scene){
  const streak=meteorStreak(meteorGeometry());
  streak.name='wishing-meteor';
  scene.add(streak);
  const origin=new THREE.Vector3(), travel=new THREE.Vector3(),width=new THREE.Vector3();
  const normal=new THREE.Vector3(),basis=new THREE.Matrix4();
  let countdown=0,age=0,duration=1,armed=false;
  const interval=()=>12+12*Math.random();
  return function update(delta,night,reduce){
    if(night<=.1||reduce){streak.visible=false;armed=false;return;}
    if(!armed){countdown=interval();armed=true;}
    countdown-=delta;
    if(countdown<=0){
      countdown=interval(); age=0; duration=.9+.3*Math.random();
      const azimuth=3.82+.24*Math.random(),elevation=THREE.MathUtils.degToRad(55+15*Math.random());
      origin.set(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)).multiplyScalar(140);
      travel.set(Math.cos(azimuth),-1,-Math.sin(azimuth)).normalize();
      width.crossVectors(origin,travel).normalize();normal.crossVectors(travel,width);
      streak.quaternion.setFromRotationMatrix(basis.makeBasis(travel,width,normal));
      streak.visible=true;
    }
    if(!streak.visible)return;
    age+=delta;
    const t=Math.min(1,age/duration);
    streak.position.copy(origin).addScaledVector(travel,145*t);
    streak.material.uniforms.intensity.value=night*THREE.MathUtils.smoothstep(t,0,.12)*(1-THREE.MathUtils.smoothstep(t,.73,1));
    streak.visible=t<1;
  };
}
