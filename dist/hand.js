// Photo cursor. Its pinch point is anchored at 15.2% / 21.1% of the supplied photo.
export function createHand(host){
 const hand=document.createElement('div');hand.className='photo-hand';hand.setAttribute('aria-hidden','true');
 const image=document.createElement('img');image.src='hand.webp';image.alt='';image.draggable=false;hand.appendChild(image);host.appendChild(hand);
 let loaded=false,enabled=true,inside=false,x=0,y=0,pressed=false;
 const toggle=document.getElementById('handEnabled'),size=document.getElementById('handSize');
 function sync(){host.classList.toggle('photo-cursor',enabled&&loaded);hand.classList.toggle('visible',enabled&&loaded&&inside);hand.classList.toggle('pinching',pressed);}
 image.onload=()=>{loaded=true;sync()};image.onerror=()=>{loaded=false;sync()};if(image.complete&&image.naturalWidth)image.onload();
 function at(clientX,clientY){const r=host.getBoundingClientRect();x=clientX-r.left;y=clientY-r.top;hand.style.left=x+'px';hand.style.top=y+'px';}
 host.addEventListener('pointermove',e=>{inside=true;at(e.clientX,e.clientY);sync()});
 host.addEventListener('pointerenter',e=>{inside=true;at(e.clientX,e.clientY);sync()});
 host.addEventListener('pointerleave',()=>{inside=false;sync()});
 if(toggle)toggle.onchange=()=>{enabled=toggle.checked;sync()};
 if(size)size.oninput=()=>{hand.style.setProperty('--hand-width',size.value+'px');document.getElementById('handSizeValue').textContent=size.value+' px'};
 return {update({holding,worldPoint,camera,hovering,demo}){pressed=holding;hand.classList.toggle('over-fabric',hovering||holding);if(worldPoint&&holding){const p=worldPoint.clone().project(camera);hand.style.left=((p.x+1)/2*host.clientWidth)+'px';hand.style.top=((-p.y+1)/2*host.clientHeight)+'px';}else{hand.style.left=x+'px';hand.style.top=y+'px'}if(demo)inside=true;sync()},hide(){inside=false;pressed=false;sync()}};
}
