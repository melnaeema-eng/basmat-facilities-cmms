import {supabase} from './supabaseClient'
export async function cycleRpc(name,args={}){
 const {data,error}=await supabase.rpc(name,args)
 if(error)throw error
 return data
}
export function migrationMissing(error){return error?.code==='PGRST202'||error?.code==='42883'||/Could not find.*bf44_/i.test(error?.message||'')}
export const readCycle=org=>cycleRpc('bf44_center',{p_org:org||null})
export const readDossier=id=>cycleRpc('bf44_dossier',{p_work_order:id})
export const closeout=(id,action)=>cycleRpc('bf44_closeout_action',{p_work_order:id,p_action:action})
export const statementAction=(action,id,data={})=>cycleRpc('bf44_statement_action',{p_action:action,p_id:id||null,p_data:data})
export const readStatement=id=>cycleRpc('bf44_statement_read',{p_id:id})
export const decideApproval=(id,action,comment='')=>cycleRpc('bf44_approval_action',{p_action:action,p_id:id,p_data:{comment}})
