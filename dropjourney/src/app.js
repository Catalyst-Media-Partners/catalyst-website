(() => {
  'use strict';
  const chapters = ['why','who','when','where','what'];
  const chapterMeta = {
    why:{glyph:'◌',aside:'An industry of connected opportunity.'},
    who:{glyph:'✳',aside:'Eight connected ways to do business at INFUSED.'},
    when:{glyph:'⧖',aside:'A place and time to move business forward.'},
    where:{glyph:'◎',aside:'A setting that makes new connections possible.'},
    what:{glyph:'↗',aside:'Find your next opportunity, from the floor to the buyer room.'}
  };
  const $ = (selector, scope=document) => scope.querySelector(selector);
  const $$ = (selector, scope=document) => [...scope.querySelectorAll(selector)];
  const stageView = $('#experience');
  const introView = $('#threshold');
  const drop = $('#journey-drop');
  const navigation = $('#site-nav');
  const navTrigger = $('#nav-trigger');
  const liquidCanvas = $('#liquid-canvas');
  const liquidVeil = $('#liquid-veil');
  const liquidContext = liquidCanvas.getContext('2d', {alpha: true});
  const transitionDuration = 1000;
  const exchangeAt = 460;
  let active = null;
  let transitioning = false;
  let liquidAnimationId = 0;
  let currentRipple = null;
  let hoverRipple = null;
  let lastWaterFrame = 0;
  const WAVE_LIFE = 860; // One damped pebble wave, not a full-screen wash.
  const HOVER_LIFE = 690; // Stop work after the surface has settled.
  const DRAG_POSITION_OMEGA = 28; // Critically damped follow, stable across display refresh rates.
  const DRAG_SHAPE_OMEGA = 16; // Surface tension: elongates with velocity, then relaxes.
  const DRAG_MAX_STRETCH = .70; // Bounded deformation, not a cursor-trail effect.
  const HOVER_RING_COUNT = 3; // One primary meniscus and two phase-coupled echoes.
  const HOVER_RING_RADII = [21,27.8,34.5]; // Compact water surface, not a click-wave train.

  const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
  // Motion is automatic when permitted. No activation button; respect the OS preference.
  const reduced=()=>motionQuery.matches;
  function setChapterURL(name){
    if(location.protocol==='about:')return;
    const url=new URL(location.href);
    url.hash=name||'';
    const destination=url.pathname+url.search+url.hash;
    if(destination!==location.pathname+location.search+location.hash){
      history.pushState({chapter:name||'intro'},'',destination);
    }
  }
  function closeNav() { navigation.hidden = true; navTrigger.setAttribute('aria-expanded', 'false'); }
  function closeToTop() {
    if (window.scrollY > 100) window.scrollTo({top:0,behavior:transitioning||reduced()?'instant':'smooth'});
  }
  function showIntro({setHash=true,focus=true}={}) {
    active = null;
    document.body.classList.add('intro-mode');
    document.body.dataset.stage = 'intro';
    stageView.hidden = true;
    introView.hidden = false;
    closeNav();
    if(setHash)setChapterURL(null);
    closeToTop();
    if(focus)$('#enter-drop').focus({preventScroll:true});
  }
  function openChapter(name,{setHash=true,focus=true}={}) {
    const i = chapters.indexOf(name);
    if (i < 0) return;
    const changed = active !== name;
    active = name;
    introView.hidden = true;
    stageView.hidden = false;
    document.body.classList.remove('intro-mode');
    document.body.dataset.stage = name;
    if(setHash)setChapterURL(name);
    $$('.chapter-panel').forEach(panel => { panel.hidden = panel.dataset.chapter !== name; });
    $$('.chapter-nav button').forEach(btn => {
      const current = btn.dataset.go === name;
      if(current)btn.setAttribute('aria-current','step');
      else btn.removeAttribute('aria-current');
    });
    $('#chapter-counter').textContent = `${String(i+1).padStart(2,'0')} / 05`;
    $('#kinetic-number').textContent = String(i+1).padStart(2,'0');
    $('#kinetic-name').textContent = name.toUpperCase();
    $('#drop-glyph').textContent = chapterMeta[name].glyph;
    $('#aside-word').textContent = name.toUpperCase();
    $('#aside-quote').textContent = chapterMeta[name].aside;
    $('.journey-track').setAttribute('aria-valuenow',String(i+1));
    $('#journey-track-fill').style.width = `${(i+1)*20}%`;
    $('.keyboard-hint span').textContent = `${String(i+1).padStart(2,'0')} / 05`;
    $('#previous').disabled = i===0;
    const last = i===chapters.length-1;
    $('#next').innerHTML = last ? 'CHOOSE YOUR PATH <span aria-hidden="true">&#8595;</span>' : 'NEXT CHAPTER <span aria-hidden="true">→</span>';
    $('#drop-action').textContent = last ? 'CHOOSE YOUR PATH' : 'NEXT / ' + chapters[i+1].toUpperCase();
    drop.setAttribute('aria-label',last?'Focus the participation choices for INFUSED':`Continue to chapter ${chapters[i+1]}`);
    // The droplet remains visually steady between chapters; water moves instead.
    drop.classList.remove('is-shifting');
    closeNav();
    closeToTop();
    if(focus) $(`#${name}-title`).focus({preventScroll:true});
  }

  // Exact pointer/touch origin takes precedence. Keyboard activation uses the
  // activating control's visual center so Enter and Space feel intentional.
  function liquidOrigin(event, control) {
    if(event && event.detail !== 0 && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      return {x:event.clientX,y:event.clientY};
    }
    const r=(control||drop).getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2};
  }
  // Lightweight water model using the native Canvas 2D and Web Animations APIs.
  // One crest/trough pair represents a *single* traveling capillary wave.
  // Hover is a low-amplitude displacement under the pointer, not a ring trail.
  const clamp = n => Math.min(1,Math.max(0,n));
  const easeOut = t => 1-Math.pow(1-clamp(t),2);
  function fitCanvas() {
    // Pixel-ratio cap, fixed number of wave samples, and an idle RAF shutdown
    // avoid the perpetual full-screen shaders used by heavier water libraries.
    const ratio=Math.min(window.devicePixelRatio||1,1.25);
    const w=window.innerWidth,h=window.innerHeight;
    const pw=Math.ceil(w*ratio),ph=Math.ceil(h*ratio);
    if(liquidCanvas.width!==pw||liquidCanvas.height!==ph){liquidCanvas.width=pw;liquidCanvas.height=ph;}
    liquidContext.setTransform(ratio,0,0,ratio,0,0);
    return {w,h};
  }
  function crestPath(ctx,x,y,radius,time,skew=0){
    const samples=64; // Constant-cost polyline, no particles or pixel processing.
    ctx.beginPath();
    for(let i=0;i<=samples;i++){
      const theta=i*Math.PI*2/samples;
      const wobble=.007*Math.sin(theta*7+time*.003)+.003*Math.cos(theta*11-time*.002);
      const r=radius*(1+wobble);
      const px=x+Math.cos(theta)*r*(1+skew);
      const py=y+Math.sin(theta)*r/(1+skew*.24);
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.closePath();
  }
  function waterCrest(ctx,x,y,radius,amplitude,time,skew=0){
    if(radius<2||amplitude<=.002)return;
    // A paired crest and trough approximates a sloped water surface. Both
    // are different edges of the SAME wavefront, not separate ripple rings.
    crestPath(ctx,x,y,radius+2,time,skew);
    ctx.strokeStyle=`rgba(0,17,28,${(amplitude*.31).toFixed(3)})`;
    ctx.lineWidth=3.5;ctx.stroke();
    crestPath(ctx,x,y,radius,time,skew);
    ctx.strokeStyle=`rgba(207,250,231,${amplitude.toFixed(3)})`;
    ctx.lineWidth=1.7;ctx.stroke();
  }
  // Closed-form critically damped spring (constant target for this frame).
  // Unlike fixed-frame easing, it behaves consistently at 30/60/120 Hz and
  // never requires a fluid grid, shader, or a continuous animation loop.
  function dampedSpring(value,velocity,target,omega,dt){
    const offset=value-target;
    const impulse=velocity+omega*offset;
    const decay=Math.exp(-omega*dt);
    return {value:target+(offset+impulse*dt)*decay,
            velocity:(velocity-omega*impulse*dt)*decay};
  }
  // Three coupled capillary fronts share the SAME inertial pointer state.
  // Phases differ just enough for neighboring crests to approach and separate.
  // They are not repeated click ripples or a particle trail.
  function dragContour(ctx,h,radius,now,layer=0){
    const points=56; // Fixed geometry, independently of movement and viewport.
    const stretch=h.stretch,ux=h.dirX,uy=h.dirY;
    const phase=now*.0028;
    // The outer fronts lag farther along the drag vector, as water would.
    const lag=layer*(1.2+2.9*stretch);
    const cx=h.x-lag*ux,cy=h.y-lag*uy;
    ctx.beginPath();
    for(let i=0;i<=points;i++){
      const theta=i*Math.PI*2/points;
      const forward=Math.cos(theta),side=Math.sin(theta);
      const behind=Math.max(0,-forward),ahead=Math.max(0,forward);
      const along=forward*radius*(1+stretch*(1.16*behind*behind+.14*ahead));
      const cross=side*radius*(1-.16*stretch);
      // Low-amplitude asymmetric ripples. Shared and phase-delayed components
      // gently interfere rather than tracing three perfect concentric circles.
      const common=Math.sin(3*theta+phase)*.58;
      const echo=Math.sin(5*theta-phase*.72-layer*1.35)*.31;
      const shear=Math.sin(2*theta+phase*.43+layer*.86)*stretch*.33;
      const wave=(common+echo+shear)*(.46+.66*stretch)*(1+layer*.16);
      const bend=stretch*radius*.025*behind*Math.sin(2*theta+now*.007);
      const px=cx+(along+wave*forward)*ux-(cross+bend+wave*side)*uy;
      const py=cy+(along+wave*forward)*uy+(cross+bend+wave*side)*ux;
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.closePath();
  }
  function drawWaterMeniscus(ctx,h,radius,amplitude,now,layer){
    if(amplitude<=.002)return;
    // A dark trough and a broken, angle-lit crest simulate meniscus depth.
    // Gradients are native Canvas strokes; no blur, texture, or GPU shader.
    dragContour(ctx,h,radius+1.7,now,layer);
    ctx.strokeStyle=`rgba(6,21,30,${(amplitude*.32).toFixed(3)})`;
    ctx.lineWidth=2.5;ctx.stroke();
    dragContour(ctx,h,radius,now,layer);
    const glint=ctx.createLinearGradient(h.x-radius,h.y-radius,h.x+radius,h.y+radius);
    glint.addColorStop(0,`rgba(222,250,232,${(amplitude*.78).toFixed(3)})`);
    glint.addColorStop(.28,`rgba(137,210,197,${(amplitude*.41).toFixed(3)})`);
    glint.addColorStop(.59,`rgba(49,116,116,${(amplitude*.25).toFixed(3)})`);
    glint.addColorStop(.88,`rgba(228,253,227,${(amplitude*.88).toFixed(3)})`);
    glint.addColorStop(1,`rgba(176,229,207,${(amplitude*.55).toFixed(3)})`);
    ctx.strokeStyle=glint;
    ctx.lineWidth=1.35;ctx.stroke();
  }
  function drawHover(now){
    if(!hoverRipple||transitioning||$('#buyer-dialog').open)return false;
    const h=hoverRipple;
    const age=now-h.movedAt;
    if(age>HOVER_LIFE)return false;
    const dt=Math.min(.05,Math.max(.001,(now-h.frameAt)/1000));
    h.frameAt=now;
    // Inertial position tracks the pointer; no abrupt jump on fast drags.
    const sx=dampedSpring(h.x,h.vx,h.tx,DRAG_POSITION_OMEGA,dt);
    const sy=dampedSpring(h.y,h.vy,h.ty,DRAG_POSITION_OMEGA,dt);
    h.x=sx.value;h.y=sy.value;h.vx=sx.velocity;h.vy=sy.velocity;
    const separation=Math.hypot(h.tx-h.x,h.ty-h.y);
    if(separation>66){
      const limit=66/separation;
      h.x=h.tx-(h.tx-h.x)*limit;
      h.y=h.ty-(h.ty-h.y)*limit;
    }
    // Velocity is measured from pointer events, then decays without movement;
    // it does not remain elongated merely because the last event was fast.
    const speed=Math.hypot(h.inputVx,h.inputVy);
    const settling=Math.exp(-Math.max(0,age-70)/105);
    const targetStretch=DRAG_MAX_STRETCH*clamp((speed-35)/1050)*settling;
    const spring=dampedSpring(h.stretch,h.stretchV,targetStretch,DRAG_SHAPE_OMEGA,dt);
    h.stretch=spring.value;h.stretchV=spring.velocity;
    const attenuation=Math.pow(1-clamp(age/HOVER_LIFE),2.1);
    const amplitude=(.132+.020*h.stretch/DRAG_MAX_STRETCH)*attenuation;
    // Outer echo is weakest when stationary and responds to fast drags.
    // Draw farthest first so the primary meniscus always stays legible.
    for(let layer=HOVER_RING_COUNT-1;layer>=0;layer--){
      const ringAmplitude=amplitude*(layer===0?1:layer===1?.49:.23+.12*h.stretch/DRAG_MAX_STRETCH);
      const radius=HOVER_RING_RADII[layer]+Math.sin(now*.0038-layer*1.6)*(.35+layer*.24);
      drawWaterMeniscus(liquidContext,h,radius,ringAmplitude,now,layer);
    }
    return true;
  }
  function drawClick(now){
    if(!currentRipple)return false;
    const t=now-currentRipple.start;
    if(t>=WAVE_LIFE){currentRipple=null;return false;}
    const p=clamp(t/WAVE_LIFE);
    const {x,y}=currentRipple;
    const radius=4+currentRipple.reach*easeOut(p);
    // Expanding capillary wave with viscous decay, approx A(t) = A0·e^(-kt).
    const alpha=.41*Math.exp(-2.05*p)*Math.pow(1-p,.72);
    waterCrest(liquidContext,x,y,radius,alpha,now);
    return true;
  }
  function drawWaterFrame(now){
    liquidAnimationId=0;
    if(document.hidden||reduced()){
      currentRipple=null;hoverRipple=null;
      liquidContext.clearRect(0,0,liquidCanvas.width,liquidCanvas.height);
      document.body.classList.remove('has-water-hover');
      return;
    }
    // Hover is throttled to <=30 fps; click still uses full RAF for a smooth crest.
    if(!currentRipple&&now-lastWaterFrame<32){liquidAnimationId=requestAnimationFrame(drawWaterFrame);return;}
    lastWaterFrame=now;
    const {w,h}=fitCanvas();
    liquidContext.clearRect(0,0,w,h);
    const moving=drawHover(now);
    const expanding=drawClick(now);
    document.body.classList.toggle('has-water-hover',moving&&!transitioning);
    if(moving||expanding)liquidAnimationId=requestAnimationFrame(drawWaterFrame);
  }
  function scheduleWater(){if(!liquidAnimationId)liquidAnimationId=requestAnimationFrame(drawWaterFrame);}
  function triggerWater(point){
    const {w,h}=fitCanvas();
    currentRipple={...point,start:performance.now(),reach:Math.min(360,Math.max(190,Math.min(w,h)*.47))};
    hoverRipple=null;
    document.body.classList.remove('has-water-hover');
    scheduleWater();
  }
  // Passive pointer listening preserves native scrolling. Touch-drag also
  // produces a gentle surface displacement without locking the gesture.
  document.addEventListener('pointermove',e=>{
    if(reduced()||transitioning||!e.isPrimary||$('#buyer-dialog').open)return;
    if(e.pointerType==='touch'&&e.buttons===0)return;
    if(e.target instanceof Element && e.target.closest('.site-nav,.buyer-dialog'))return;
    const x=e.clientX,y=e.clientY;
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    const now=performance.now();
    if(!hoverRipple||now-hoverRipple.movedAt>HOVER_LIFE){
      hoverRipple={x,y,tx:x,ty:y,vx:0,vy:0,inputVx:0,inputVy:0,
                   dirX:1,dirY:0,stretch:0,stretchV:0,
                   movedAt:now,frameAt:now};
    }else{
      const h=hoverRipple;
      const elapsed=Math.max(8,now-h.movedAt);
      let inputVx=(x-h.tx)*1000/elapsed,inputVy=(y-h.ty)*1000/elapsed;
      // Avoid huge apparent velocities from browser pointer-event coalescing.
      const rawSpeed=Math.hypot(inputVx,inputVy);
      if(rawSpeed>2200){inputVx*=2200/rawSpeed;inputVy*=2200/rawSpeed;}
      const weight=1-Math.exp(-elapsed/32);
      h.inputVx+=(inputVx-h.inputVx)*weight;
      h.inputVy+=(inputVy-h.inputVy)*weight;
      const v=Math.hypot(h.inputVx,h.inputVy);
      if(v>24){
        // Direction follows the actual drag vector with slight rotational lag.
        const turn=Math.min(.82,1-Math.exp(-elapsed/38));
        h.dirX+=(h.inputVx/v-h.dirX)*turn;
        h.dirY+=(h.inputVy/v-h.dirY)*turn;
        const length=Math.hypot(h.dirX,h.dirY)||1;
        h.dirX/=length;h.dirY/=length;
      }
    }
    hoverRipple.tx=x;hoverRipple.ty=y;hoverRipple.movedAt=now;
    scheduleWater();
  },{passive:true});
  document.addEventListener('pointercancel',()=>{hoverRipple=null;},{passive:true});
  document.addEventListener('pointerleave',()=>{hoverRipple=null;},{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      currentRipple=null;hoverRipple=null;
      if(liquidAnimationId)cancelAnimationFrame(liquidAnimationId);
      liquidAnimationId=0;
      if(liquidContext)liquidContext.clearRect(0,0,liquidCanvas.width,liquidCanvas.height);
      document.body.classList.remove('has-water-hover');
    }
  });
  function goTo(name,event,{splash=false,originControl=null,setHash=true}={}) {
    if(transitioning||name===active)return;
    if(name!==null&&!chapters.includes(name))return;
    if(reduced()){
      if(name===null)showIntro({setHash});else openChapter(name,{setHash});
      $('#liquid-live').textContent=name===null?'Journey restarted':`Now exploring ${name}`;
      return;
    }
    const control=originControl || event?.currentTarget || drop;
    const point=liquidOrigin(event,control);
    transitioning=true;
    const body=document.body;
    const maxRadius=Math.ceil(Math.hypot(Math.max(point.x,window.innerWidth-point.x),Math.max(point.y,window.innerHeight-point.y))*1.12);
    body.style.setProperty('--water-x',`${point.x}px`);
    body.style.setProperty('--water-y',`${point.y}px`);
    body.style.setProperty('--water-far',`${maxRadius}px`);
    body.classList.add('is-transitioning','is-dissolving');
    $('#story-main').setAttribute('aria-busy','true');
    liquidVeil.style.setProperty('--impact-x',`${point.x}px`);
    liquidVeil.style.setProperty('--impact-y',`${point.y}px`);
    triggerWater(point);
    if(splash){
      control.classList.add('is-splashing');
      control.classList.remove('is-shifting');
    }
    window.setTimeout(()=>{
      if(name===null)showIntro({setHash,focus:false});
      else openChapter(name,{setHash,focus:false});
      body.classList.remove('is-dissolving');
      body.classList.add('is-revealing');
    },exchangeAt);
    window.setTimeout(()=>{
      body.classList.remove('is-transitioning','is-revealing','is-dissolving');
      control.classList.remove('is-splashing');
      $('#story-main').removeAttribute('aria-busy');
      transitioning=false;
      if(name===null)$('#enter-drop').focus({preventScroll:true});
      else $(`#${name}-title`).focus({preventScroll:true});
      $('#liquid-live').textContent=name===null?'Journey restarted':`Now exploring ${name}`;
    },transitionDuration);
  }
  function focusFinalDecision(){
    const firstChoice = $('#what .final-role-links a');
    if(!firstChoice)return;
    firstChoice.scrollIntoView({block:'nearest',behavior:reduced()?'instant':'smooth'});
    firstChoice.focus({preventScroll:true});
    $('#liquid-live').textContent = 'Choose Attend, Exhibit, or Hosted Buyers';
  }
  function next(event,fromDrop=false){
    if(active==='what'){
      // At the end of the guided journey, offer a real audience choice.
      // The drop and NEXT never infer that this visitor is an exhibitor.
      focusFinalDecision();
      return;
    }
    const i=chapters.indexOf(active);
    const target=chapters[i+1]||'why';
    goTo(target,event,{splash:fromDrop,originControl:fromDrop?drop:null});
  }
  function previous(event){const i=chapters.indexOf(active);if(i>0)goTo(chapters[i-1],event);}
  $('#enter-drop').addEventListener('click',event=>goTo('why',event,{splash:true,originControl:event.currentTarget}));
  $('#skip-intro').addEventListener('click',event=>goTo('why',event));
  $('#restart').addEventListener('click',event=>goTo(null,event));
  $('#journey-drop').addEventListener('click',event=>next(event,true));
  $('#next').addEventListener('click',event=>next(event));
  $('#previous').addEventListener('click',event=>previous(event));
  $$('.chapter-nav button').forEach(button=>button.addEventListener('click',event=>goTo(button.dataset.go,event)));
  navTrigger.addEventListener('click',()=>{const expanded=navTrigger.getAttribute('aria-expanded')==='true';navigation.hidden=expanded;navTrigger.setAttribute('aria-expanded',String(!expanded));if(!expanded)navigation.querySelector('a[href]')?.focus();else navTrigger.focus();});
  navigation.addEventListener('focusout',event=>{if(!navigation.contains(event.relatedTarget)&&event.relatedTarget!==navTrigger)closeNav();});
  document.addEventListener('click',event=>{if(!navigation.hidden&&!navigation.contains(event.target)&&!navTrigger.contains(event.target))closeNav();});
  $('#skip').addEventListener('click',event=>{if(introView.hidden)return;event.preventDefault();goTo('why',event);});
  const dialog = $('#buyer-dialog');
  const form = $('#buyer-form');
  let buyerStep = 0;
  const buyerSteps = $$('.buyer-step',dialog);
  const buyerLabels = ['Role','Sourcing','Priorities','Company','Contact','Review'];
  function hideBuyerError(){const error=$('#buyer-error');error.hidden=true;error.textContent='';}
  function displayBuyerError(message,focusTarget) {
    const error=$('#buyer-error');error.textContent=message;error.hidden=false;
    if(focusTarget)focusTarget.focus({preventScroll:false});else error.scrollIntoView({block:'nearest'});
  }
  function formField(name){return form.elements.namedItem(name);}
  const formVal = name => (formField(name)?.value||'').trim();
  const checkedValues = name => $$(`input[name="${name}"]:checked`,form).map(el=>el.value);
  function validateBuyerStep(index) {
    hideBuyerError();
    if(index===0){
      if(checkedValues('buyer_role').length===0)return displayBuyerError('Choose the buyer role closest to yours.',$('input[name="buyer_role"]',form)),false;
      if(!formField('buyer_confirm').checked)return displayBuyerError('Confirm that your work includes sourcing, purchasing, distribution, or category development.',formField('buyer_confirm')),false;
    }
    if(index===1&&checkedValues('sourcing_categories').length===0)return displayBuyerError('Choose at least one sourcing category.',$('input[name="sourcing_categories"]',form)),false;
    if(index===2&&!formVal('products_sought'))return displayBuyerError('Describe the products or capabilities you are looking for.',formField('products_sought')),false;
    if(index===3&&!formVal('company_name'))return displayBuyerError('Enter your company name.',formField('company_name')),false;
    if(index===4){
      for(const name of ['contact_name','title','email','phone']){if(!formVal(name))return displayBuyerError('Complete the required contact details.',formField(name)),false;}
      const email=formField('email');if(!email.validity.valid)return displayBuyerError('Enter a valid business email.',email),false;
      if(formVal('phone').replace(/\D/g,'').length<7)return displayBuyerError('Enter a valid contact phone number.',formField('phone')),false;
    }
    return true;
  }
  function buyerSummaryFields(){return [
    ['Buyer role',checkedValues('buyer_role').join(', ')],
    ['Sourcing categories',checkedValues('sourcing_categories').join(', ')],
    ['Specific priorities',formVal('products_sought')],
    ['Preferred suppliers',formVal('preferred_suppliers')||'Not specified'],
    ['Sourcing challenges',formVal('sourcing_challenges')||'Not specified'],
    ['Company',formVal('company_name')],
    ['Operating footprint',formVal('operating_footprint')||'Not specified'],
    ['Contact',formVal('contact_name')],
    ['Role / title',formVal('title')],
    ['Business email',formVal('email')],
    ['Phone',formVal('phone')]
  ];}
  function renderBuyerSummary(){const review=$('#buyer-review');review.replaceChildren();for(const [label,value] of buyerSummaryFields()){
    const row=document.createElement('div');row.className='review-row';
    const dt=document.createElement('dt');dt.textContent=label;
    const dd=document.createElement('dd');dd.textContent=value;
    row.append(dt,dd);review.append(row);
  }}
  function setBuyerStep(index,{focus=true}={}){
    if(index<0||index>=buyerSteps.length)return;
    buyerStep=index;hideBuyerError();buyerSteps.forEach((step,i)=>{step.hidden=i!==index;});
    const count=index+1;
    $('#buyer-current').textContent=`${String(count).padStart(2,'0')} / 06`;
    $('#buyer-meter').setAttribute('aria-valuenow',String(count));
    $('#buyer-meter-fill').style.width=`${count/6*100}%`;
    $('#buyer-prev').disabled=index===0;
    $('#buyer-forward').hidden=index===5;
    $('#buyer-copy').hidden=index!==5;
    if(index===5)renderBuyerSummary();
    dialog.scrollTop=0;
    if(focus){const heading=$('h3',buyerSteps[index]);heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
  }
  function openBuyer(){closeNav();if(!dialog.open)dialog.showModal();document.body.classList.add('dialog-open');setBuyerStep(buyerStep,{focus:true});}
  $$('.buyer-step').forEach(s=>{s.addEventListener('change',hideBuyerError);s.addEventListener('input',hideBuyerError);});
  $$('[data-open-buyer]').forEach(button=>button.addEventListener('click',openBuyer));
  $('#close-buyer').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{document.body.classList.remove('dialog-open');$('#buyer-status').textContent='';});
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  $('#buyer-prev').addEventListener('click',()=>setBuyerStep(buyerStep-1));
  $('#buyer-forward').addEventListener('click',()=>{if(validateBuyerStep(buyerStep))setBuyerStep(buyerStep+1);});
  form.addEventListener('submit',e=>{e.preventDefault();$('#buyer-status').textContent='This is a non-submitting preview. Your information has not been sent.';});
  $('#buyer-copy').addEventListener('click',async()=>{
    const data=buyerSummaryFields().map(([label,val])=>`${label}: ${val}`).join('\n');
    const text=`INFUSED Las Vegas | Hosted Buyer Profile Draft\n\n${data}\n\nPreview only: not submitted.`;
    try{await navigator.clipboard.writeText(text);$('#buyer-status').textContent='Draft copied to your clipboard. No application has been submitted.';}
    catch(_){$('#buyer-status').textContent='Clipboard unavailable here. Select and copy the information above. No application has been submitted.';}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(!navigation.hidden){closeNav();navTrigger.focus();}return;}
    if(dialog.open||e.altKey||e.ctrlKey||e.metaKey||!active)return;
    const target=e.target;
    if(target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(e.key==='ArrowRight'){e.preventDefault();next(null);}
    if(e.key==='ArrowLeft'){e.preventDefault();previous(null);}
  });
  // popstate handles Back/Forward through pushState chapters and native page visits.
  // hashchange additionally supports hand-edited URLs and manual hash jumps.
  function restoreFromURL(){
    const target=location.hash.slice(1).toLowerCase();
    if(chapters.includes(target))openChapter(target,{setHash:false,focus:false});
    else if(!target)showIntro({setHash:false,focus:false});
  }
  window.addEventListener('popstate',restoreFromURL);
  window.addEventListener('hashchange',restoreFromURL);
  const initial=location.hash.slice(1).toLowerCase();
  if(chapters.includes(initial))openChapter(initial,{setHash:false,focus:false});
  else {active=null;introView.hidden=false;stageView.hidden=true;}
})();
