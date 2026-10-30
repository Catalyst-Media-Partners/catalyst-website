/* Portable drop landing: only approved configured destinations. No analytics SDK or form collection. */
(()=>{
 'use strict';
 const params=new URLSearchParams(location.search);
 const base=document.querySelector('meta[name="infused-base"]')?.content||'/dropjourneytest/';
 const allowed=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id'];
 const safe=/^[A-Za-z0-9][A-Za-z0-9._~:-]{0,95}$/;
 for(const link of document.querySelectorAll('a[data-offer-link]')){
  const url=new URL(link.href,location.href);
  if(url.origin!=='https://infused.show'||!url.pathname.startsWith(base))continue;
  for(const key of allowed){const value=params.get(key);if(value&&safe.test(value)&&!url.searchParams.has(key))url.searchParams.set(key,value);}
  link.href=url.href;
 }
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const drop=document.querySelector('.lander-drop');
 const canvas=document.querySelector('.water-canvas');
 const ctx=canvas?.getContext?.('2d');
 let hover=null,click=null,raf=0,last=0;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function draw(t){
  if(!ctx||reduce.matches){raf=0;return;}
  if(last&&t-last<30){raf=requestAnimationFrame(draw);return;}last=t;
  const d=Math.min(devicePixelRatio||1,1.25),w=innerWidth,h=innerHeight;
  if(canvas.width!==Math.ceil(w*d)||canvas.height!==Math.ceil(h*d)){canvas.width=Math.ceil(w*d);canvas.height=Math.ceil(h*d);}
  ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
  let alive=false;
  if(hover&&t-hover.when<650){
   const p=1-(t-hover.when)/650,alpha=Math.pow(p,1.6)*.12;
   hover.x+=(hover.tx-hover.x)*.3;hover.y+=(hover.ty-hover.y)*.3;
   for(let i=0;i<3;i++){
    const r=23+i*10,st=clamp(hover.speed/1000,0,.45);
    ctx.beginPath();ctx.ellipse(hover.x,hover.y,r*(1+st),r*(1-st*.35),hover.angle,0,Math.PI*2);
    ctx.strokeStyle=`rgba(202,250,218,${(alpha*(1-i*.22)).toFixed(3)})`;ctx.lineWidth=1.2;ctx.stroke();
   }alive=true;
  }
  if(click){
   const age=Math.max(0,t-click.when);if(age<540){const p=age/540;
    ctx.beginPath();ctx.arc(click.x,click.y,13+190*Math.pow(p,.8),0,Math.PI*2);
    ctx.strokeStyle=`rgba(222,254,232,${(.36*Math.pow(1-p,1.7)).toFixed(3)})`;ctx.lineWidth=2.0;ctx.stroke();alive=true;
   }else click=null;
  }
  if(alive)raf=requestAnimationFrame(draw);else{raf=0;last=0;hover=null;}
 }
 function wake(){if(!raf)raf=requestAnimationFrame(draw)}
 if(ctx&&!reduce.matches){
  document.addEventListener('pointermove',e=>{
   if(!e.isPrimary||(e.pointerType==='touch'&&e.buttons===0))return;
   const n=performance.now(),x=e.clientX,y=e.clientY;
   if(!hover){hover={x,y,tx:x,ty:y,speed:0,angle:0,when:n};}
   else{const dt=Math.max(12,n-hover.when),dx=x-hover.tx,dy=y-hover.ty;hover.speed=Math.hypot(dx,dy)*1000/dt;if(dx||dy)hover.angle=Math.atan2(dy,dx);hover.tx=x;hover.ty=y;hover.when=n;}
   wake();
  },{passive:true});
 }
 const dropLinks=[...document.querySelectorAll('.lander-drop')];
 for(const link of dropLinks){
  link.addEventListener('click',e=>{
   if(reduce.matches||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   // Short visual response, then navigate. The native anchor remains usable if JS is unavailable.
   e.preventDefault();
   const target=link.href;
   const rect=link.getBoundingClientRect();
   click={x:rect.left+rect.width/2,y:rect.top+rect.height*.7,when:performance.now()};wake();
   link.classList.add('is-activated');
   setTimeout(()=>location.assign(target),220);
  });
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;hover=null;click=null;}});
})();
