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
  const HOVER_LIFE = 520; // Stop work after the surface has settled.
  const DRAG_POSITION_OMEGA = 28; // Critically damped follow, stable across display refresh rates.
  const DRAG_SHAPE_OMEGA = 16; // Surface tension: elongates with velocity, then relaxes.
  const DRAG_MAX_STRETCH = .70; // Bounded deformation, not a cursor-trail effect.
  const HOVER_RING_COUNT = 3; // One primary meniscus and two phase-coupled echoes.
  const HOVER_RING_RADII = [21,27.8,34.5]; // Compact water surface, not a click-wave train.

  const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton=$('#motion-optin');
  let motionOptIn=false;
  const reduced=()=>motionQuery.matches&&!motionOptIn;
  function syncMotionButton(){
    if(!motionQuery.matches){
      motionOptIn=false;
      document.body.classList.remove('motion-opt-in');
      motionButton.hidden=true;
      return;
    }
    motionButton.hidden=false;
    motionButton.textContent=motionOptIn?'Disable water animation':'Enable water animation';
    motionButton.setAttribute('aria-pressed',String(motionOptIn));
  }
  motionButton.addEventListener('click',()=>{
    if(transitioning)return;
    motionOptIn=!motionOptIn;
    document.body.classList.toggle('motion-opt-in',motionOptIn);
    syncMotionButton();
  });
  if(typeof motionQuery.addEventListener==='function')motionQuery.addEventListener('change',syncMotionButton);
  syncMotionButton();
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
    if(setHash && location.protocol!=='about:')history.replaceState(null,'',location.pathname+location.search);
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
    if(setHash && location.protocol!=='about:')history.replaceState(null,'',`#${name}`);
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
    $('#next').innerHTML = last ? 'BACK TO BEGINNING <span aria-hidden="true">↺</span>' : 'NEXT CHAPTER <span aria-hidden="true">→</span>';
    $('#drop-action').textContent = last ? 'TOUCH THE DROP TO RESTART' : 'TOUCH THE DROP TO CONTINUE';
    drop.setAttribute('aria-label',last?'Restart the five-chapter journey':`Continue to chapter ${chapters[i+1]}`);
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
    ctx.strokeStyle=`rgba(207,2 --- TRUNCATED --- 26,314 chars