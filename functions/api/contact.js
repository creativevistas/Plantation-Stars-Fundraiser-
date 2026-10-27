// Cloudflare Pages Function: relay validated contact inquiries without redirecting visitors.
// FormSubmit still requires a one-time activation email to the recipient.
const FORMSUBMIT_URL = "https://formsubmit.co/ajax/jlsvista@aol.com";
const VALID_TYPES = new Set(["Guest-player invitation", "Business sponsorship", "Other baseball opportunity"]);
const json = (data,status=200) => Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const clean = (value,max) => typeof value==="string" ? value.trim().slice(0,max) : "";

export async function onRequestPost({request}) {
  const siteOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");
  if(origin && origin!==siteOrigin)return json({ok:false,error:"Request not allowed."},403);
  const referer=request.headers.get("Referer");
  if(!origin && referer && !referer.startsWith(siteOrigin+"/"))return json({ok:false,error:"Request not allowed."},403);
  if(!(request.headers.get("Content-Type")||"").includes("application/json"))return json({ok:false,error:"Invalid request."},415);
  const length=Number(request.headers.get("Content-Length")||0);
  if(length>12000)return json({ok:false,error:"Your message is too long."},413);
  let data;
  try { data=await request.json(); }catch { return json({ok:false,error:"Invalid request."},400); }
  if(!data||typeof data!=="object"||Array.isArray(data))return json({ok:false,error:"Invalid request."},400);
  if(clean(data._honey,200))return json({ok:true});
  const name=clean(data.name,120);
  const email=clean(data.email,160);
  const inquiry_type=clean(data.inquiry_type,80);
  const team_or_business=clean(data.team_or_business,160);
  const message=clean(data.message,3000);
  if(!name||!message||!VALID_TYPES.has(inquiry_type)||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    return json({ok:false,error:"Please complete the required fields."},400);
  }
  const payload={
    name,email,inquiry_type,team_or_business,message,
    _subject:"New guest-player or sponsorship inquiry for Theodore Vista",
    _template:"table",
    _url:"https://theodore-vista-cooperstown.pages.dev/#contact"
  };
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch(FORMSUBMIT_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json","Referer":"https://theodore-vista-cooperstown.pages.dev/#contact"},
      body:JSON.stringify(payload),
      signal:controller.signal
    });
    const result=await response.json().catch(()=>null);
    const providerAccepted=Boolean(result && (result.success===true||result.success==="true"));
    if(!response.ok||!providerAccepted){
      const activation=typeof result?.message==="string" && /activat|confirm your form/i.test(result.message);
      if(activation)return json({ok:false,code:"activation_required",error:"Contact form is awaiting activation. Please try again later."},409);
      console.error("Form provider rejected contact request",response.status);
      return json({ok:false,error:"Your message could not be sent. Please try again."},502);
    }
    return json({ok:true});
  } catch(err) {
    console.error("Form provider request failed");
    return json({ok:false,error:"Contact service did not respond. Please try again."},504);
  } finally {clearTimeout(timer)}
}
