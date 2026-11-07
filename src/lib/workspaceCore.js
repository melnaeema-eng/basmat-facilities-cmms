export const maintenanceStages={assignment:['draft','assigned','accepted'],execution:['in_progress','on_hold'],review:['completed'],closeout:['approved'],closed:['closed']}
export const terminalStatuses = new Set(['closed','cancelled'])
export function maintenanceStage(status){
 if(status==='cancelled')return 'cancelled'
 if(status==='closed')return 'closed'
 if(status==='approved')return 'closeout'
 if(status==='completed')return 'review'
 if(['in_progress','on_hold'].includes(status))return 'execution'
 return 'assignment'
}
export function monthRange(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit'}).formatToParts(now)
 const year=Number(parts.find(x=>x.type==='year').value),month=Number(parts.find(x=>x.type==='month').value)
 return {start:`${year}-${String(month).padStart(2,'0')}-01`,end:`${month===12?year+1:year}-${String(month===12?1:month+1).padStart(2,'0')}-01`}
}
