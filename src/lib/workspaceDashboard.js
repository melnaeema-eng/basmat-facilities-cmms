import {supabase} from './supabaseClient'
import {monthRange,maintenanceStages} from './workspaceCore'
export async function loadWorkspaceDashboard(can,organizationId){
 const {start,end}=monthRange()
 function query(table){let q=supabase.from(table).select('id',{count:'exact',head:true});return organizationId?q.eq('organization_id',organizationId):q}
 const definitions=[
  ['assets','assets.view',()=>query('bf_assets').eq('status','active')],
  ['active','corrective.view',()=>query('bf_work_orders').not('status','in','(closed,cancelled)')],
  ['execution','corrective.view',()=>query('bf_work_orders').in('status',maintenanceStages.execution)],
  ['review','corrective.view',()=>query('bf_work_orders').in('status',maintenanceStages.review)],
  ['closeout','corrective.view',()=>query('bf_work_orders').in('status',maintenanceStages.closeout)],
  ['closed','corrective.view',()=>query('bf_work_orders').in('status',maintenanceStages.closed)],
  ['assignment','corrective.view',()=>query('bf_work_orders').in('status',maintenanceStages.assignment)],
  ['overdue','corrective.view',()=>query('bf_work_orders').not('status','in','(closed,cancelled)').eq('sla_status','breached')],
  ['ppmTotal','ppm.view',()=>query('bf_ppm_jobs').gte('due_date',start).lt('due_date',end).neq('status','cancelled')],
  ['ppmDone','ppm.view',()=>query('bf_ppm_jobs').gte('due_date',start).lt('due_date',end).in('status',['completed','approved','closed'])]
 ]
 const result={counts:{},errors:[],rows:[],assets:{}}
 await Promise.all(definitions.filter(([,permission])=>can(permission)).map(async([key,,run])=>{
  try{const {count,error}=await run();if(error)throw error;result.counts[key]=count}
  catch{result.counts[key]=null;result.errors.push(key)}
 }))
 if(can('corrective.view')){
  let q=supabase.from('bf_work_orders').select('id,work_order_number,title,priority,status,asset_id,completion_due_at,created_at').order('created_at',{ascending:false}).limit(8)
  if(organizationId)q=q.eq('organization_id',organizationId)
  const {data,error}=await q
  if(error)result.errors.push('recent');else result.rows=data||[]
  const ids=[...new Set(result.rows.map(x=>x.asset_id).filter(Boolean))]
  if(can('assets.view')&&ids.length){
   const {data:assets,error:assetError}=await supabase.from('bf_assets').select('id,asset_tag,name_ar,name_en,serial_number').in('id',ids)
   if(assetError)result.errors.push('assetNames');else result.assets=Object.fromEntries((assets||[]).map(a=>[a.id,a]))
  }
 }
 return result
}
