// Independent dynamic shell. The supplied body mesh is never mutated.
export class ClothPhysics{
 constructor(positions,normals){this.base=positions.slice();this.normals=normals.slice();this.positions=positions.slice();this.offset=new Float32Array(positions.length);this.velocity=new Float32Array(positions.length);this.stretch=new Float32Array(positions.length/3);this.weights=new Float32Array(positions.length/3);this.active=false;this.anchor=null;this.max=0;for(let k=0;k<positions.length;k++)this.positions[k]+=.014*this.normals[k];}
 grab(point){this.anchor={x:point.x,y:point.y,z:point.z};this.active=true;}
 step(dt,pull,elastic=55){dt=Math.min(.04,Math.max(0,dt));const steps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/steps,kSpring=70+elastic*1.6,damping=2*Math.sqrt(kSpring)*.7,length=Math.hypot(pull.x,pull.y,pull.z),spread=.38+length*.36;let maximum=0;
 for(let k=0;k<this.base.length;k+=3){let w=0;if(this.anchor&&this.active){const dx=this.base[k]-this.anchor.x,dy=this.base[k+1]-this.anchor.y,dz=this.base[k+2]-this.anchor.z;w=Math.exp(-Math.pow(Math.hypot(dx,dy,dz)/spread,1.6)*2.2);if(this.base[k]*this.anchor.x<0)w=0;const y=(this.base[k+1]/6.3+1.073938/2);w*=Math.max(0,Math.min(1,(.855-y)/.035,y/.045));}this.weights[k/3]=w;
 for(let step=0;step<steps;step++){for(let c=0;c<3;c++){const j=k+c,desired=(c===0?pull.x:c===1?pull.y:pull.z)*w;this.velocity[j]+=(kSpring*(desired-this.offset[j])-damping*this.velocity[j])*h;this.offset[j]+=this.velocity[j]*h;}const dot=this.offset[k]*this.normals[k]+this.offset[k+1]*this.normals[k+1]+this.offset[k+2]*this.normals[k+2];if(dot<0){const vn=this.velocity[k]*this.normals[k]+this.velocity[k+1]*this.normals[k+1]+this.velocity[k+2]*this.normals[k+2];for(let c=0;c<3;c++){this.offset[k+c]-=dot*this.normals[k+c];if(vn<0)this.velocity[k+c]-=vn*this.normals[k+c];}}}
 for(let c=0;c<3;c++)this.positions[k+c]=this.base[k+c]+this.normals[k+c]*.014+this.offset[k+c];const d=Math.hypot(this.offset[k],this.offset[k+1],this.offset[k+2]);this.stretch[k/3]=d;maximum=Math.max(maximum,d);}
 this.max=maximum;return maximum;
 }
 release(){this.active=false;}
 reset(){this.active=false;this.anchor=null;this.offset.fill(0);this.velocity.fill(0);this.stretch.fill(0);this.max=0;for(let k=0;k<this.base.length;k++)this.positions[k]=this.base[k]+this.normals[k]*.014;}
}
