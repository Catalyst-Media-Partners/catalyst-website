// Ticket notifications are an email-only consent and verification flow.
// Hosted Buyer / Contact forms use a separate intake subsystem.
(()=>{
 const form=document.getElementById('ticket-notify-form');
 if(!form)return;
 const button=document.getElementById('ticket-notify-submit'),status=document.getElementById('ticket-notify-status'),email=form.querySelector('input[name="email"]');
 const tell=(message,ok=false)=>{status.textContent=message;status.dataset.state=ok?'success':'error';};
 const endpoint='/dropjourneytest/tickets/api/subscribe';
 fetch('/dropjourneytest/tickets/api/status',{credentials:'omit',cache:'no-store'}).then(r=>r.json()).then(x=>{
  if(!x.enabled){button.disabled=true;tell('Email registration is temporarily unavailable. Please check back shortly.');}
 }).catch(()=>{button.disabled=true;tell('Email registration is temporarily unavailable.');});
 let busy=false;
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy||button.disabled)return;
  if(!form.reportValidity()){tell('Enter a valid email address.');return;}
  const widget=form.querySelector('.cf-turnstile');
  const token=String(new FormData(form).get('cf-turnstile-response')||'');
  if(token.length<10){tell('Complete the security check before continuing.');return;}
  busy=true;button.disabled=true;button.setAttribute('aria-busy','true');
  tell('Sending your verification email…',true);
  try{
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),17000);
   let response;try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',redirect:'error',body:JSON.stringify({email:email.value,turnstile:token}),signal:controller.signal});}
   finally{clearTimeout(timeout);}
   const x=await response.json();if(!response.ok||!x.ok)throw Error(x.error||'Unable to send verification email.');
   tell(x.message||'Check your inbox and click the verification link.',true);
   email.disabled=true;button.textContent='Verification email requested';form.dataset.completed='true';
  }catch(e){
   tell(e.name==='AbortError'?'The request timed out. Please try again.':String(e.message||'Unable to send verification email.'));
   if(window.turnstile?.reset)try{window.turnstile.reset(widget);}catch{}
  }finally{busy=false;button.disabled=!!form.dataset.completed;button.removeAttribute('aria-busy');}
 });
})();
