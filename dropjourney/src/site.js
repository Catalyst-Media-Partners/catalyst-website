/* S02 shared interactions: accessible navigation, safe attribution, buyer flow and gentle water. */
(()=>{
'use strict';
const root='/dropjourneytest/';
const drawer=document.getElementById('dj-drawer');
const trigger=document.querySelector('.dj-explore');
function closeNav({focus=false}={}){
  if(!drawer||!trigger)return;
  drawer.hidden=true;trigger.setAttribute('aria-expanded','false');
  if(focus)trigger.focus();
}
trigger?.addEventListener('click',()=>{
  const open=drawer.hidden;
  drawer.hidden=!open;trigger.setAttribute('aria-expanded',String(open));
  if(open)drawer.querySelector('a')?.focus();else trigger.focus();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!drawer?.hidden){e.preventDefault();closeNav({focus:true});}
  if(e.key==='Tab'&&!drawer?.hidden&&trigger){
    const focusable=[trigger,...drawer.querySelectorAll('a[href]')];
    if(e.shiftKey&&document.activeElement===focusable[0]){e.preventDefault();focusable.at(-1).focus();}
    else if(!e.shiftKey&&document.activeElement===focusable.at(-1)){e.preventDefault();trigger.focus();}
  }
});
document.addEventListener('pointerdown',e=>{
  if(!drawer?.hidden&&!drawer.contains(e.target)&&!trigger?.contains(e.target))closeNav();
});
drawer?.addEventListener('focusout',e=>{
  if(e.relatedTarget!==trigger&&!drawer.contains(e.relatedTarget))closeNav();
});

// Keep first-party UTM continuity through namespaced navigation. No cookie, storage, or personal identifiers.
const token=/^[A-Za-z0-9][A-Za-z0-9._~-]{0,95}$/;
const keys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
const inherited=new URLSearchParams(location.search);
const utm=Object.fromEntries(keys.map(k=>[k,token.test(inherited.get(k)||'')?inherited.get(k):null]));
for(const a of document.querySelectorAll('a[href]')){
  const raw=a.getAttribute('href');if(!raw||raw.startsWith('#'))continue;
  let dest;try{dest=new URL(raw,location.href)}catch{continue}
  if(dest.origin!==location.origin)continue;
  if(!dest.pathname.startsWith(root)&&dest.pathname!=='/go/booth')continue;
  if(dest.pathname==='/go/booth'){
    // Production endpoint understands only canonical original page paths.
    const originPage=location.pathname.slice(root.length-1);
    if(!dest.searchParams.has('page'))dest.searchParams.set('page',originPage||'/');
  }
  for(const [k,v] of Object.entries(utm)){if(v&&!dest.searchParams.has(k))dest.searchParams.set(k,v);}
  a.href=dest.href;
}

const form=document.getElementById('buyer-form');
if(form){
  const steps=[...form.querySelectorAll('.buyer-step')],meter=document.getElementById('buyer-meter'),fill=document.getElementById('buyer-meter-fill'),counter=document.getElementById('buyer-current');
  const prev=document.getElementById('buyer-prev'),next=document.getElementById('buyer-forward'),copy=document.getElementById('buyer-copy');
  const err=document.getElementById('buyer-error'),status=document.getElementById('buyer-status'),review=document.getElementById('buyer-review');
  let current=0;
  const field=name=>form.querySelector(`[name="${name}"]`);
  const val=name=>String(field(name)?.value||'').trim();
  const selected=name=>[...form.querySelectorAll(`input[name="${name}"]:checked`)].map(e=>e.value);
  function complain(message,focus){err.hidden=false;err.textContent=message;focus?.focus();return false;}
  function valid(i){err.hidden=true;err.textContent='';
    if(i===0){if(!selected('buyer_role').length)return complain('Choose the buyer role closest to yours.',form.querySelector('[name=buyer_role]'));if(!field('buyer_confirm')?.checked)return complain('Confirm your sourcing or buying role.',field('buyer_confirm'));}
    if(i===1&&!selected('sourcing_categories').length)return complain('Choose at least one sourcing category.',form.querySelector('[name=sourcing_categories]'));
    if(i===2&&!val('products_sought'))return complain('Describe the products or capabilities you need.',field('products_sought'));
    if(i===3&&!val('company_name'))return complain('Enter a company name.',field('company_name'));
    if(i===4){for(const n of ['contact_name','title','email','phone']){if(!val(n))return complain('Complete the required contact details.',field(n));}if(!field('email').checkValidity())return complain('Enter a valid business email.',field('email'));if(val('phone').replace(/\D/g,'').length<7)return complain('Enter a valid phone number.',field('phone'));}
    return true;
  }
  const fields=()=>[['Buyer role',selected('buyer_role').join(', ')],['Sourcing categories',selected('sourcing_categories').join(', ')],['Specific priorities',val('products_sought')],['Preferred suppliers',val('preferred_suppliers')||'Not specified'],['Sourcing challenges',val('sourcing_challenges')||'Not specified'],['Company',val('company_name')],['Operating footprint',val('operating_footprint')||'Not specified'],['Contact',val('contact_name')],['Title or role',val('title')],['Business email',val('email')],['Phone',val('phone')]];
  function show(i){if(i<0||i>=steps.length)return;current=i;steps.forEach((s,j)=>s.hidden=j!==i);counter.textContent=String(i+1).padStart(2,'0')+' / 06';meter.setAttribute('aria-valuenow',String(i+1));fill.style.width=((i+1)/6*100)+'%';prev.disabled=i===0;next.hidden=i===5;copy.hidden=i!==5;err.hidden=true;status.textContent='';
    if(i===5){review.replaceChildren();for(const [label,value] of fields()){const row=document.createElement('div');row.className='review-row';const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);review.append(row);}}
    const title=steps[i].querySelector('h3');title.tabIndex=-1;title.focus({preventScroll:true});window.scrollTo({top:Math.max(0,document.querySelector('.dj-wizard').getBoundingClientRect().top+scrollY-105),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  }
  next?.addEventListener('click',()=>{if(valid(current))show(current+1);});prev?.addEventListener('click',()=>show(current-1));
  copy?.addEventListener('click',async()=>{const txt='INFUSED hosted buyer profile draft\n\n'+fields().map(([k,v])=>k+': '+v).join('\n')+'\n\nDraft only. Not submitted.';try{await navigator.clipboard.writeText(txt);status.textContent='Draft copied. No application has been submitted.';}catch{status.textContent='Clipboard unavailable; select and copy the review details. No application has been submitted.';}});
  for(const s of steps)s.addEventListener('input',()=>{err.hidden=true;});
  steps.forEach((s,i)=>s.hidden=i!==0);prev.disabled=true;copy.hidden=true;next.hidden=false;
}

// Water pointer interaction: three softly coupled crests sharing one inertial pointer,
// with a single traveling capillary wave on click. Fixed geometry and 30fps cap.
const canvas=document.querySelector('.dj-water');
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
if(!canvas||reduced.matches||!canvas.getContext)return;
const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;
let hover=null,click=null,handle=0,lastFrame=0;
const cap=(n,min,max)=>Math.min(max,Math.max(min,n));
const spring=(v,d,target,omega,dt)=>{const x=v-target,imp=d+omega*x,decay=Math.exp(-omega*dt);return [target+(x+imp*dt)*decay,(d-omega*imp*dt)*decay];};
function size(){const ratio=Math.min(devicePixelRatio||1,1.25),w=Math.ceil(innerWidth*ratio),h=Math.ceil(innerHeight*ratio);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}ctx.setTransform(ratio,0,0,ratio,0,0);}
function ring(h,radius,alpha,t,layer){const points=56,angle=Math.atan2(h.dy,h.dx);const sx=Math.cos(angle),sy=Math.sin(angle),stretch=h.stretch,lag=layer*(1+2*stretch),cx=h.x-lag*sx,cy=h.y-lag*sy;const wave=(th)=>Math.sin(th*3+t*.003)*.38+Math.cos(th*5-t*.002-layer)*.23;ctx.beginPath();for(let i=0;i<=points;i++){const th=i*Math.PI*2/points,front=Math.cos(th),side=Math.sin(th),behind=Math.max(0,-front);const along=front*radius*(1+stretch*(1.15*behind*behind+.12*Math.max(0,front)))+wave(th),cross=side*radius*(1-.13*stretch)+wave(th)*.15;const x=cx+along*sx-cross*sy,y=cy+along*sy+cross*sx;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.lineWidth=3;ctx.strokeStyle=`rgba(8,21,31,${(alpha*.28).toFixed(3)})`;ctx.stroke();ctx.lineWidth=1.2;const gradient=ctx.createLinearGradient(cx-radius,cy-radius,cx+radius,cy+radius);gradient.addColorStop(0,`rgba(205,248,224,${alpha*.7})`);gradient.addColorStop(.5,`rgba(119,188,171,${alpha*.27})`);gradient.addColorStop(1,`rgba(221,250,221,${alpha*.87})`);ctx.strokeStyle=gradient;ctx.stroke();}
function tick(t){if(!lastFrame)lastFrame=t;if(t-lastFrame<31){handle=requestAnimationFrame(tick);return;}let active=false;const dt=Math.min(.048,Math.max(.008,(t-lastFrame)/1000));lastFrame=t;size();ctx.clearRect(0,0,innerWidth,innerHeight);
  if(hover&&t-hover.when<950){const h=hover;const sx=spring(h.x,h.vx,h.tx,17,dt),sy=spring(h.y,h.vy,h.ty,17,dt);h.x=sx[0];h.vx=sx[1];h.y=sy[0];h.vy=sy[1];const age=t-h.when;const target=.55*cap((h.speed-35)/800,0,1)*Math.exp(-Math.max(0,age-80)/140),state=spring(h.stretch,h.stretchV,target,14,dt);h.stretch=state[0];h.stretchV=state[1];const alpha=.18*Math.pow(1-age/950,1.6);for(let k=0;k<3;k++)ring(h,26+k*11,alpha*(1-k*.23),t,k);active=true;}
  if(click){const age=t-click.t;if(age<870){const p=age/870,r=10+Math.pow(p,.8)*Math.hypot(innerWidth,innerHeight)*.78,alpha=.42*Math.pow(1-p,1.65);ring({x:click.x,y:click.y,dx:1,dy:0,stretch:0},r,alpha,t,0);active=true;}else click=null;}
  if(active)handle=requestAnimationFrame(tick);else{handle=0;lastFrame=0;hover=null;}
}
function wake(){if(!handle)handle=requestAnimationFrame(tick)}
document.addEventListener('pointermove',e=>{if(!e.isPrimary||(e.pointerType==='touch'&&e.buttons===0)||e.target.closest('.dj-drawer,.dj-wizard'))return;const now=performance.now(),x=e.clientX,y=e.clientY;if(!hover||now-hover.when>1000){hover={x,y,tx:x,ty:y,dx:1,dy:0,vx:0,vy:0,speed:0,stretch:0,stretchV:0,when:now};}else{const dt=Math.max(10,now-hover.when),vx=(x-hover.tx)*1000/dt,vy=(y-hover.ty)*1000/dt;const speed=Math.hypot(vx,vy);hover.speed=cap(speed,0,1800);if(speed>35){hover.dx=vx/speed;hover.dy=vy/speed;}}hover.tx=x;hover.ty=y;hover.when=now;wake();},{passive:true});
document.addEventListener('click',e=>{if(e.detail===0)return;if(e.target.closest('.dj-wizard'))return;click={x:e.clientX,y:e.clientY,t:performance.now()};wake();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){hover=null;click=null;if(handle)cancelAnimationFrame(handle);handle=0;ctx.clearRect(0,0,canvas.width,canvas.height);}});
})();
