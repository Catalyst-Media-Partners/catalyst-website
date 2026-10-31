// Shared native INFUSED buyer, attendee and contact forms. No external form providers.
const SITEKEY=process.env.TURNSTILE_SITEKEY||'0x4AAAAAAFtS3fhXx5j6zfT8';
const e=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function input(name,label,{type='text',required=false,limit=120,placeholder='',autocomplete='off'}={}){
 return '<label class="dj-intake-field"><span>'+e(label)+(required?' <b aria-label="required">*</b>':'')+'</span><input name="'+e(name)+'" type="'+e(type)+'" maxlength="'+limit+'"'+(required?' required':'')+' autocomplete="'+e(autocomplete)+'" placeholder="'+e(placeholder)+'"></label>';
}
function textarea(name,label,required=false,max=1500){
 return '<label class="dj-intake-field dj-intake-full"><span>'+e(label)+(required?' <b aria-label="required">*</b>':'')+'</span><textarea name="'+e(name)+'" maxlength="'+max+'" rows="4"'+(required?' required':'')+'></textarea></label>';
}
function select(name,label,options,required=true){
 return '<label class="dj-intake-field"><span>'+e(label)+(required?' <b aria-label="required">*</b>':'')+'</span><select name="'+e(name)+'"'+(required?' required':'')+'><option value="">Choose one</option>'+options.map(v=>'<option value="'+e(v)+'">'+e(v)+'</option>').join('')+'</select></label>';
}
const categories=['Finished infused products','Functional beverages','Hemp-derived products','Ingredients / formulation','Contract manufacturing / co-packing','Packaging / labeling','Distribution / wholesale','Retail solutions','General discovery','Other'];
function categoryPicker(){
 return '<fieldset class="dj-intake-categories dj-intake-full"><legend>Product categories of interest <span class="dj-intake-help">(select all that apply; buyers choose at least one)</span></legend><div class="dj-intake-checkgrid">'+categories.map(v=>'<label><input type="checkbox" name="categories" value="'+e(v)+'"> '+e(v)+'</label>').join('')+'</div></fieldset>';
}
export function renderIntakeForm(kind,{base='/dropjourneytest/'}={}){
 if(typeof base!=='string'||!base.startsWith('/')||!base.endsWith('/')||base.includes('..'))throw Error('Invalid intake base path');
 if(!['buyer','attendee','contact'].includes(kind))throw Error('Unsupported INFUSED intake type');
 const id=kind==='buyer'?'buyer-request-form':kind==='attendee'?'attendee-interest-form':'contact-request-form';
 const title=kind==='buyer'?'Request Hosted Buyer consideration':kind==='attendee'?'Request attendance updates':'Send the INFUSED team a message';
 const help=kind==='buyer'?'The team will review your sourcing needs. This is not a guarantee of hosted-buyer benefits or meetings.':kind==='attendee'?'Tickets are not yet available; this request does not reserve, purchase or issue a ticket.':'The team can respond about exhibiting, sponsorship and event participation.';
 const requiredContact='I agree that INFUSED may contact me about this specific request. I understand that this request does not guarantee any ticket, buyer acceptance, benefit, or meeting.';
 let fields=input('fullName','Full name',{required:true,autocomplete:'name'})+
 input('email',kind==='buyer'?'Business email':'Email',{type:'email',required:true,limit:254,autocomplete:'email'})+
 input('company',kind==='buyer'?'Company name':'Company (optional)',{required:kind==='buyer',limit:150,autocomplete:'organization'});
 if(kind==='buyer'){
  fields+=input('jobTitle','Job title / role',{limit:120,autocomplete:'organization-title'});
  fields+=select('buyingRole','Buying authority',['Purchasing decision-maker','Research / recommendations','Sourcing support','Other']);
  fields+=categoryPicker()+textarea('objective','What products or connections are you looking for?',true,1500);
  fields+=input('website','Company website (optional)',{type:'url',limit:240,placeholder:'https://example.com'});
  fields+=input('markets','Markets served (optional)',{limit:200});
 }else if(kind==='attendee'){
  fields+=select('attendeeRole','How would you like to experience INFUSED?',['General attendee / discovery','Industry buyer','Programming / community','Undecided']);
  fields+=categoryPicker();
 }else{
  fields+=select('inquiryTopic','Inquiry topic',['Exhibiting','Sponsorship','Hosted buyers','Partnership','Media / speaking','General']);
  fields+=textarea('message','What can we help with?',true,2000);
  fields+=input('website','Company website (optional)',{type:'url',limit:240,placeholder:'https://example.com'});
 }
 const consent='<fieldset class="dj-intake-consent dj-intake-full"><legend>Contact permissions</legend><label><input type="checkbox" name="consentContact" required> '+e(requiredContact)+' <b aria-label="required">*</b></label><label><input type="checkbox" name="consentMarketing"> I would also like to receive future INFUSED marketing and event updates. <span>(Optional; unchecked by default)</span></label></fieldset>';
 const captcha='<div class="dj-intake-full"><div class="cf-turnstile" data-sitekey="'+SITEKEY+'" data-action="infused-intake" data-theme="dark"></div><p class="dj-intake-help">Human verification is required. We do not issue tickets or approvals through this form.</p></div>';
 const honeypot='<div class="dj-intake-trap" aria-hidden="true"><label>Leave this field blank<input name="websiteConfirm" tabindex="-1" autocomplete="off"></label></div>';
 return '<section class="dj-native-intake" id="'+id+'" aria-labelledby="'+id+'-title"><h2 id="'+id+'-title">'+e(title)+'</h2><p class="dj-intake-description">'+e(help)+'</p><form class="dj-intake-form" data-intake-kind="'+kind+'" action="'+base+'api/intake" method="post" novalidate><div class="dj-intake-grid">'+fields+consent+captcha+honeypot+'</div><button class="dj-btn dj-btn-acid" type="submit">Submit '+(kind==='buyer'?'buyer request':kind==='attendee'?'attendance interest':'inquiry')+'</button><p class="dj-intake-status" role="status" aria-live="polite" aria-atomic="true"></p><p class="dj-intake-privacy">Your information is used to process this request. Optional marketing consent is recorded separately from the required inquiry contact permission.</p></form><noscript><p>This form requires JavaScript for secure submission and human verification. Contact info@cannacon.org directly if needed.</p></noscript></section><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
}
