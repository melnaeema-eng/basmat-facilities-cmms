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
