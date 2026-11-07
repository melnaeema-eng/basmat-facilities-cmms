import {readFileSync} from 'node:fs'
import {hasFacilitiesPermission} from '../src/lib/facilitiesPermissions.js'
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

test('Modern Facilities roles can open the existing operational pages',()=>{
 const permissions=[{organization_id:'provider',permission_key:'facilities.work_orders.view'},{organization_id:'provider',permission_key:'facilities.ppm.manage'}]
 assert.equal(hasFacilitiesPermission(permissions,'corrective.view','provider'),true)
 assert.equal(hasFacilitiesPermission(permissions,'ppm.execute','provider'),true)
 assert.equal(hasFacilitiesPermission(permissions,'corrective.approve','provider'),false)
})
test('Medical grants do not become Facilities permissions and organization scope remains exact',()=>{
 assert.equal(hasFacilitiesPermission([{organization_id:'medical',permission_key:'medical.work_orders.view'}],'corrective.view'),false)
 assert.equal(hasFacilitiesPermission([{organization_id:'other',permission_key:'facilities.work_orders.view'}],'corrective.view','provider'),false)
})
test('The integrated review client calls the ACL-aware endpoint',()=>{
 const source=readFileSync(new URL('../src/lib/maintenanceCycle.js',import.meta.url),'utf8')
 assert.match(source,/decideApproval.*cycleRpc\('bf44_approval_action'/)
})
