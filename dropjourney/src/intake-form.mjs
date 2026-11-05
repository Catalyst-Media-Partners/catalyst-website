// Shared, purpose-built INFUSED contact, buyer and attendance-interest forms.
// Only contact about the submitted request; never subscribe users to marketing here.
const SITEKEY=process.env.TURNSTILE_SITEKEY||'0x4AAAAAAFtS3fhXx5j6zfT8';
const e=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function input(name,label,{type='text',required=false,limit=120,placeholder='',autocomplete='off'}={}){
 return '<label class="dj-intake-field"><span>'+e(label)+(required?' <b aria-label="required">*</b>':'')+'</span><input name="'+e(name)+'" type="'+e(type)+'" maxlength="'+limit+'"'+(required?' required':'')+' autocomplete="'+e(autocomplete)+'" placeholder="'+e(placeholder)+'"></label>';
}
function textarea(name,label,required=false,max=2000){
 return '<label class="dj-intake-field dj-intake-full"><span>'+e(label)+(required?' <b aria-label="required">*</b>':'')+'</span><textarea name="'+e(name)+'" maxlength="'+max+'" rows="4"'+(required?' required':'')+'></textarea></label>';
}
function select(name,label,options,required=false){
 return '<label class="dj-intake-field"><span>'+e(label)+(required?' <b aria-label="required">*</b>':'')+'</span><select name="'+e(name)+'"'+(required?' required':'')+'><option value="">'+(required?'Select one':'Select if applicable')+'</option>'+options.map(v=>'<option value="'+e(v)+'">'+e(v)+'</option>').join('')+'</select></label>';
}
const categories=['Finished infused products','Functional beverages','Hemp-derived products','Ingredients / formulation','Contract manufacturing / co-packing','Packaging / labeling','Distribution / wholesale','Retail solutions','General discovery','Other'];
function categoryPicker(buyer){
 return '<fieldset class="dj-intake-categories dj-intake-full"><legend>'+(buyer?'What do you source? <b aria-label="required">*</b>':'Categories of interest (optional)')+'</legend><div class="dj-intake-checkgrid">'+categories.map(v=>'<label><input type="checkbox" name="categories" value="'+e(v)+'"> '+e(v)+'</label>').join('')+'</div></fieldset>';
}
export function renderIntakeForm(kind,{base='/dropjourneytest/'}={}){
 if(typeof base!=='string'||!base.startsWith('/')||!base.endsWith('/')||base.includes('..'))throw Error('Invalid intake base path');
 if(!['buyer','attendee','contact'].includes(kind))throw Error('Unsupported INFUSED intake type');
 const id=kind==='buyer'?'buyer-request-form':kind==='attendee'?'attendee-interest-form':'contact-request-form';
 const title={buyer:'Tell us what you source.',attendee:'Interested in attending INFUSED?',contact:'Talk to the INFUSED team.'}[kind];
 const lead={buyer:"Tell us what you're looking for and the kinds of suppliers you'd like to meet.",attendee:'Share your interest in the next INFUSED event.',contact:'Tell us what you need. We will get your request to the right person.'}[kind];
 let fields=input('fullName','Full name',{required:true,autocomplete:'name'})+
 input('email',kind==='buyer'?'Business email':'Email',{type:'email',required:true,limit:254,autocomplete:'email'})+
 input('company',kind==='buyer'?'Company':'Company (optional)',{required:kind==='buyer',limit:150,autocomplete:'organization'});
 if(kind==='buyer'){
  fields+=select('buyingRole','Buying role',['Purchasing decision-maker','Research / recommendations','Sourcing support','Other'],true);
  fields+=categoryPicker(true);
  fields+=textarea('objective','What would make a valuable connection? (optional)',false,1500);
  fields+=input('jobTitle','Job title (optional)',{limit:120,autocomplete:'organization-title'});
  fields+=input('website','Company website (optional)',{type:'text',limit:240,placeholder:'example.com',autocomplete:'url'});
  fields+=input('markets','Markets served (optional)',{limit:200});
 }else if(kind==='attendee'){
  fields+=select('attendeeRole','How would you participate? (optional)',['General attendee / discovery','Industry buyer','Programming / community','Undecided']);
  fields+=categoryPicker(false);
 }else{
  fields+=select('inquiryTopic','What can we help with?',['Exhibiting','Sponsorship','Hosted buyers','Partnership','Media / speaking','Tickets / attendance','General'],true);
  fields+=textarea('message','Your message',true,2000);
 }
 const consent='<fieldset class="dj-intake-consent dj-intake-full" aria-describedby="'+id+'-consent-help"><legend>Contact permission <b aria-label="required">*</b></legend><label><input type="checkbox" name="consentContact" value="on" required> I agree that the INFUSED team may contact me about this request.</label><p class="dj-intake-help" id="'+id+'-consent-help">This permission is only for responding to this request. It does not subscribe you to marketing emails.</p></fieldset>';
 const captcha='<div class="dj-intake-full"><div class="cf-turnstile" data-sitekey="'+SITEKEY+'" data-action="infused-intake" data-theme="dark"></div></div>';
 const honeypot='<div class="dj-intake-trap" aria-hidden="true"><label>Leave this field blank<input name="websiteConfirm" tabindex="-1" autocomplete="off"></label></div>';
 const button={buyer:'Send buyer request',attendee:'Send attendance interest',contact:'Send message'}[kind];
 return '<section class="dj-native-intake" id="'+id+'" aria-labelledby="'+id+'-title"><span class="dj-intake-kicker">INFUSED / LAS VEGAS 2027</span><h2 id="'+id+'-title">'+e(title)+'</h2><p class="dj-intake-description">'+e(lead)+'</p>'+
 '<form class="dj-intake-form" data-intake-kind="'+kind+'" action="'+base+'api/intake" method="post" novalidate>'+
 '<div class="dj-intake-grid">'+fields+consent+captcha+honeypot+'</div><button class="dj-btn dj-btn-acid" type="submit">'+e(button)+'</button>'+
 '<p class="dj-intake-status" role="status" aria-live="polite" aria-atomic="true"></p>'+
 '<p class="dj-intake-privacy">We use your information to respond to this request.</p></form>'+
 '<noscript><p>This form requires JavaScript for secure submission. Questions? Email info@cannacon.org.</p></noscript>'+
 '</section><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
}
