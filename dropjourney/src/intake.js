// First-party, accessible INFUSED form submission; personal data is sent only
// to the same-origin Cloudflare intake endpoint. No third-party form host.
(function(){
 const forms=document.querySelectorAll('form.dj-intake-form[data-intake-kind]');
 for(const form of forms){
  let requestId=null,busy=false;
  const submit=form.querySelector('button[type="submit"]'),status=form.querySelector('.dj-intake-status');
  const tell=(message,ok)=>{status.textContent=message;status.dataset.state=ok?'success':'error';};
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   if(busy)return;
   if(!form.reportValidity()){tell('Please complete the required fields.',false);return;}
   const f=new FormData(form);
   const token=String(f.get('cf-turnstile-response')||'');
   if(token.length<10){tell('Complete the human verification before submitting.',false);return;}
   if(form.dataset.intakeKind==='buyer'&&!f.getAll('categories').length){tell('Select at least one sourcing category.',false);return;}
   requestId??=crypto.randomUUID();
   const payload={
    kind:form.dataset.intakeKind,requestId,fullName:String(f.get('fullName')||''),
    email:String(f.get('email')||''),company:String(f.get('company')||''),
    jobTitle:String(f.get('jobTitle')||''),buyingRole:String(f.get('buyingRole')||''),
    attendeeRole:String(f.get('attendeeRole')||''),
    categories:f.getAll('categories').map(String),
    objective:String(f.get('objective')||''),message:String(f.get('message')||''),
    website:String(f.get('website')||''),markets:String(f.get('markets')||''),
    inquiryTopic:String(f.get('inquiryTopic')||''),websiteConfirm:String(f.get('websiteConfirm')||''),
    consentContact:f.has('consentContact'),consentMarketing:f.has('consentMarketing'),
    turnstileToken:token,sourcePage:location.pathname
   };
   busy=true;submit.disabled=true;submit.setAttribute('aria-busy','true');tell('Submitting securely…',true);
   try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    let response;
    try{response=await fetch('/dropjourneytest/api/intake',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',redirect:'error',body:JSON.stringify(payload),signal:controller.signal});}
    finally{clearTimeout(timer);}
    const result=await response.json();
    if(!response.ok||!result.ok)throw Error(String(result.error||'Submission failed. Please try again.'));
    tell('Request received. Receipt: '+result.receiptId+'. '+(payload.kind==='attendee'?'This is not a ticket or reservation.':'The INFUSED team will review your request.'),true);
    form.querySelectorAll('input,select,textarea,button').forEach(el=>{el.disabled=true;});
    requestId=null;form.dataset.completed='true';
   }catch(err){
    tell(err.name==='AbortError'?'Response timed out. Check your connection and retry.':String(err.message||'Submission failed. Please retry.'),false);
    if(window.turnstile?.reset)try{window.turnstile.reset(form.querySelector('.cf-turnstile'));}catch{}
   }finally{busy=false;submit.disabled=!!form.dataset.completed;submit.removeAttribute('aria-busy');}
  });
 }
})();
