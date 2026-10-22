// Production request path. Isolated HTML design reviews substitute tickets-preview.js.
(() => {
 const form=document.querySelector('#ticket-notify-form');if(!form)return;
 const input=form.querySelector('#notify-email'),btn=form.querySelector('#notify-submit'),status=form.querySelector('#notify-result');
 function message(text,error=false){status.hidden=false;status.textContent=text;status.classList.toggle('error',error);}
 form.addEventListener('submit',async event=>{
  event.preventDefault();status.hidden=true;
  const address=input.value.trim();
  if(!input.checkValidity() || !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(address)){
    message('Enter a valid email address.',true);input.focus();return;
  }
  const token=form.querySelector('[name="cf-turnstile-response"]')?.value;
  if(!token){message('Complete the verification check.',true);return;}
  btn.disabled=true;
  try{
    const response=await fetch('/tickets/api/subscribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:address,turnstile:token})});
    const result=await response.json();
    message(result.message||'The request could not be processed.',!response.ok);
    if(response.ok){form.reset();window.turnstile?.reset();}
  }catch{message('Could not reach the notification service. Try again later.',true);}
  finally{btn.disabled=false;}
 });
})();
