import test from 'node:test'
import assert from 'node:assert/strict'
import {cycleSteps,reviewApproved} from '../src/lib/cycleProgress.js'
import {formatCycleMoney} from '../src/lib/cycleMoney.js'
test('A certificate or a draft statement does not mark the maintenance cycle closed',()=>{
 const d={work_order:{status:'approved'},report:{},certificate:{},policy:{},approvals:[{reviewer_type:'owner',round:1,status:'approved'}],statement:{status:'draft'}}
 assert.equal(cycleSteps(d).find(s=>s.key==='closed').done,false)
 d.work_order.status='closed';d.statement.status='approved'
 assert.equal(cycleSteps(d).find(s=>s.key==='closed').done,true)
})
test('The newest rejection invalidates an earlier approval and the optional consultant is explicit',()=>{
 assert.equal(reviewApproved([{reviewer_type:'owner',round:1,status:'approved'},{reviewer_type:'owner',round:2,status:'rejected'}],'owner'),false)
 assert.equal(cycleSteps({work_order:{},policy:{}}).find(s=>s.key==='consultant').optional,true)
})
test('Financial statement formatting preserves decimal strings and large values exactly',()=>{
 assert.equal(formatCycleMoney('9007199254740993.01','en'),'9,007,199,254,740,993.01')
 assert.equal(formatCycleMoney('125.5','en'),'125.50')
 assert.equal(formatCycleMoney('not-a-number'),'—')
})
