import { chromium } from 'playwright';

const TEST_TOKEN = 'lv27_readonly_probe_20261020';
const target = 'https://shows.map-dynamics.com/infusedlv2027/?register&catalyst_click_id='+TEST_TOKEN+
  '&utm_source=qa_internal&utm_campaign=mapd_attribution_probe';
const results = [];
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  for (const [label,url] of [['baseline','https://shows.map-dynamics.com/infusedlv2027/?register'],['tagged',target]]) {
    const page = await browser.newPage({viewport:{width:1280,height:880}});
    let tokenRequests=0,networkFailures=0;
    page.on('request',r=>{if(r.url().includes(TEST_TOKEN))tokenRequests++;});
    page.on('requestfailed',()=>networkFailures++);
    let response,err;
    try {
      response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      await page.waitForTimeout(2500);
    }catch(e){err=String(e).slice(0,150);}
    let detail={};
    try {
      detail=await page.evaluate((token)=>{
        const contains=(str)=>typeof str==='string'&&str.includes(token);
        const hasFormToken=[...document.querySelectorAll('form')].some(x=>contains(x.getAttribute('action')));
        const hasInputToken=[...document.querySelectorAll('input')].some(x=>contains(x.value)||contains(x.getAttribute('name')));
        const hasHrefToken=[...document.querySelectorAll('a[href]')].some(x=>contains(x.getAttribute('href')));
        const hasIframeToken=[...document.querySelectorAll('iframe')].some(x=>contains(x.getAttribute('src')));
        return {
          title:document.title.slice(0,120),
          urlToken:location.search.includes(token),
          htmlToken:document.documentElement.outerHTML.includes(token),
          hasFormToken,hasInputToken,hasHrefToken,hasIframeToken,
          formCount:document.forms.length,iframeCount:document.querySelectorAll('iframe').length,
          buttons:document.querySelectorAll('button,input[type=submit]').length,
          mapdLinks:[...document.querySelectorAll('a[href]')].filter(x=>x.href.includes('checkout.map-dynamics.com')).length
        };
      },TEST_TOKEN);
    }catch(e){detail={error:String(e).slice(0,150)};}
    results.push({label,status:response?.status()||null,path:(()=>{try{let z=new URL(page.url());return z.origin+z.pathname}catch{return 'unavailable'}})(),err,
      tokenRequests,networkFailures,detail});
    await page.close();
  }
}finally{await browser.close();}
try {
 const url='https://app.mapdevents.com/api/external/v1/openapi.json';
 const res=await fetch(url,{signal:AbortSignal.timeout(15000)});
 const body=await res.text();let j;try{j=JSON.parse(body)}catch{}
 const paths=Object.keys(j?.paths||{});
 results.push({label:'public_modern_api_spec',status:res.status,hasSpec:paths.length>0,pathCount:paths.length,
   orderPaths:paths.filter(p=>/order|check.?out|form|question|registr|sale/i.test(p)).slice(0,60)});
}catch(e){results.push({label:'public_modern_api_spec',error:String(e).slice(0,180)});}
console.log('MAPD_ATTRIBUTION_READONLY_PROBE '+JSON.stringify(results));
if(results.some(x=>x.label==='tagged' && x.err)) process.exitCode=1;
