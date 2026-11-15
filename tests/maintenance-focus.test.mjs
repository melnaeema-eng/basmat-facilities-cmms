import test from 'node:test'
import assert from 'node:assert/strict'
import {maintenanceAction,checklistFocus} from '../src/lib/maintenanceFocus.js'
const steps=[{id:'a',title_en:'Inspect'},{id:'b',title_en:'Test'},{id:'c',title_en:'Record'}]
test('only a persisted result advances the checklist; failed results remain attention items',()=>{
 assert.equal(checklistFocus(steps,[]).next.id,'a')
 assert.equal(checklistFocus(steps,[{step_id:'a',result:''}]).next.id,'a')
 const focus=checklistFocus(steps,[{step_id:'a',result:'fail'}])
 assert.equal(focus.next.id,'b');assert.equal(focus.failed[0].id,'a')
 assert.equal(focus.completed.length,1)
})
test('saved results survive refresh and fully recorded checklist requests submission',()=>{
 const results=steps.map(s=>({step_id:s.id,result:'pass'}))
 assert.equal(checklistFocus(steps,results).next,null)
 assert.equal(maintenanceAction({kind:'ppm',status:'in_progress',assigned:true,steps,results}).key,'submit')
})
test('assignment, acceptance, execution and review transfer responsibility without inventing names',()=>{
 assert.equal(maintenanceAction({status:'draft'}).key,'assign')
 assert.equal(maintenanceAction({status:'assigned',assigned:false}).key,'assign')
 assert.equal(maintenanceAction({status:'assigned',assigned:true,technician:'Magdi'}).responsible,'Magdi')
 assert.equal(maintenanceAction({status:'accepted',assigned:true}).key,'start')
 assert.equal(maintenanceAction({status:'on_hold',assigned:true}).key,'resume')
 assert.equal(maintenanceAction({status:'completed',approvalStatus:'pending'}).key,'review')
 assert.equal(maintenanceAction({status:'completed',approvalStatus:'rejected'}).key,'submit')
 assert.equal(maintenanceAction({kind:'ppm',status:'completed'}).key,'review')
})
test('closed and cancelled records have no next responsible person; integrated approval routes to dossier',()=>{
 for(const status of ['closed','cancelled'])assert.equal(maintenanceAction({status}).terminal,true)
 assert.equal(maintenanceAction({status:'approved',integrated:true}).key,'dossier')
 assert.equal(maintenanceAction({status:'approved'}).key,'close')
})
test('Arabic and English use readable role fallbacks and the next step title',()=>{
 assert.equal(maintenanceAction({status:'in_progress',assigned:true,lang:'en'}).responsible,'Assigned technician')
 assert.equal(maintenanceAction({kind:'ppm',status:'in_progress',assigned:true,lang:'en',steps,results:[{step_id:'a',result:'pass'}]}).title,'Test')
 assert.equal(maintenanceAction({kind:'request',status:'submitted'}).key,'triage')
})

import {cycleNextAction} from '../src/lib/cycleProgress.js'
const dossier=()=>({work_order:{status:'approved'},policy:{},approvals:[],trace:{}})
test('optional consultant is skipped, pending owner is a wait and rejection returns to supervisor',()=>{
 const d=dossier();assert.equal(cycleNextAction(d).key,'report');d.report={}
 assert.equal(cycleNextAction(d).key,'submit')
 d.approvals=[{reviewer_type:'owner',round:1,status:'pending'}]
 assert.deepEqual(cycleNextAction(d),{key:'owner',role:'owner'})
 d.approvals.push({reviewer_type:'owner',round:2,status:'rejected'})
 assert.deepEqual(cycleNextAction(d),{key:'rework',role:'supervisor'})
})
test('required consultant precedes owner and financial closure follows certificate',()=>{
 const d=dossier();d.report={};d.policy.consultant_reviewer='reviewer'
 d.approvals=[{reviewer_type:'owner',round:1,status:'approved'},{reviewer_type:'consultant',round:1,status:'pending'}]
 assert.equal(cycleNextAction(d).key,'consultant')
 d.approvals[1].status='approved';assert.equal(cycleNextAction(d).key,'certificate')
 d.certificate={};assert.deepEqual(cycleNextAction(d),{key:'statement',role:'contractor'})
 d.statement={status:'owner_review'};assert.equal(cycleNextAction(d).role,'owner')
 d.statement.status='approved';d.work_order.status='closed';assert.equal(cycleNextAction(d).terminal,true)
})

import {executionFocus} from '../src/lib/maintenanceFocus.js'
test('execution packages advance by persisted sequence, retaining reading/text results and failed steps',()=>{
 const steps=[{seq:1},{seq:2},{seq:3}]
 assert.equal(executionFocus(steps,[]).next.seq,1)
 const results=[{step_seq:'1',reading_value:0},{step_seq:2,pass_fail:'fail'}]
 const focus=executionFocus(steps,results)
 assert.equal(focus.next.seq,3);assert.equal(focus.failed[0].seq,2)
 assert.equal(focus.completed.length,2)
 assert.equal(executionFocus(steps,[...results,{step_seq:3,result_text:'Recorded'}]).next,null)
})
