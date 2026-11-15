export function latestReview(approvals,kind){return (approvals||[]).filter(a=>a.reviewer_type===kind).sort((a,b)=>b.round-a.round)[0]}
export function reviewApproved(approvals,kind){return latestReview(approvals,kind)?.status==='approved'}
export function cycleSteps(dossier){
 const w=dossier.work_order||{},finished=['completed','approved','closed'].includes(w.status),internallyApproved=['approved','closed'].includes(w.status)
 const consultantNeeded=!!dossier.policy?.consultant_reviewer
 return [
  ['registered',true],['execution',finished],['internal',internallyApproved],['report',!!dossier.report],
  ['consultant',!consultantNeeded||reviewApproved(dossier.approvals,'consultant')],['owner',reviewApproved(dossier.approvals,'owner')],
  ['certificate',!!dossier.certificate],['statement',!!dossier.statement],['closed',w.status==='closed'&&dossier.statement?.status==='approved']
 ].map(([key,done])=>({key,done,optional:key==='consultant'&&!consultantNeeded}))
}


export function cycleNextAction(d){
 const w=d.work_order||{},approvals=d.approvals||[]
 if(w.status==='cancelled')return {key:'cancelled',role:null,terminal:true}
 if(w.status==='closed'&&d.statement?.status==='approved')return {key:'closed',role:null,terminal:true}
 if(!['approved','closed'].includes(w.status))return {key:w.status==='completed'?'internal':'execution',role:w.status==='completed'?'supervisor':'technician'}
 if(!d.report)return {key:'report',role:'supervisor'}
 const consultant=latestReview(approvals,'consultant'),owner=latestReview(approvals,'owner')
 const outstanding=d.policy?.consultant_reviewer&&consultant?.status!=='approved'?['consultant',consultant]:owner?.status!=='approved'?['owner',owner]:null
 if(outstanding){
  const [role,review]=outstanding
  return review?.status==='pending'?{key:role,role}:{key:review?.status==='rejected'?'rework':'submit',role:'supervisor'}
 }
 if(!d.certificate)return {key:'certificate',role:'supervisor'}
 if(!d.statement)return {key:'statement',role:'contractor'}
 if(d.statement.status!=='approved')return {key:'statement',role:d.statement.status==='owner_review'?'owner':'contractor'}
 return {key:'close',role:'supervisor'}
}
