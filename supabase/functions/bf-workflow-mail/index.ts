import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import {renderWorkflowMail} from './render.mjs';
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 const apiKey=Deno.env.get('RESEND_API_KEY');
 const from=Deno.env.get('CMMS_FROM_EMAIL')||Deno.env.get('MAIL_FROM')||Deno.env.get('ACADEMY_FROM_EMAIL');
 if(req.method==='GET')return json({configured:!!apiKey&&!!from});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 if(Number(req.headers.get('content-length')||0)>2048)return json({error:'Invalid request'},400);
 let token:string;
 try{const body=await req.json();token=body?.token;if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return json({error:'Unauthorized'},401)}catch{return json({error:'Invalid request'},400)}
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 // RPC execution is service-role only and verifies the database-held runner token.
 // No recipient, message or destination is ever accepted from the HTTP caller.
 if(!apiKey||!from)return json({error:'CMMS mail transport is not configured'},503);
 const claimed=await db.rpc('bf_mail_claim',{p_token:token,p_limit:10});
 if(claimed.error)return json({error:'Dispatcher authentication or queue failed'},403);
 let sent=0,failed=0;
 for(const job of claimed.data||[]){
  try{
   const mail=renderWorkflowMail(job);
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`cmms-workflow-${job.id}`},body:JSON.stringify({from,to:[job.email],subject:mail.subject,html:mail.html,text:mail.text}),signal:AbortSignal.timeout(12000)});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(`Email provider ${response.status}: ${String(result.message||'rejected').slice(0,300)}`);
   const ack=await db.rpc('bf_mail_result',{p_token:token,p_id:job.id,p_lease:job.lease,p_sent:true,p_provider:result.id||null});if(ack.error)throw Error('Delivery acknowledgement failed');sent++;
  }catch(error){failed++;await db.rpc('bf_mail_result',{p_token:token,p_id:job.id,p_lease:job.lease,p_sent:false,p_error:String(error instanceof Error?error.message:error).slice(0,500)});}
  await new Promise(resolve=>setTimeout(resolve,600));
 }
 return json({sent,failed});
});
