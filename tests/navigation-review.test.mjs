import test from 'node:test'
import assert from 'node:assert/strict'
import {modules} from '../src/config/modules.js'
import {navigationGroups,toolFamilies,standaloneTools,primaryPaths,familyForPath,toolsForPath,secondaryNavigation,isNavigableModule} from '../src/config/navigation.js'

test('One primary entry per task and each specialist belongs to exactly one family',()=>{
 const primary=navigationGroups.flatMap(g=>g.paths)
 assert.equal(new Set(primary).size,primary.length)
 const specialist=toolFamilies.flatMap(f=>f.tools)
 assert.equal(new Set(specialist).size,specialist.length)
 for(const path of specialist){assert.ok(!primaryPaths.has(path),path);assert.ok(!modules.find(m=>m.path===path).nav,path)}
 assert.deepEqual(modules.filter(m=>m.nav).map(m=>m.path).sort(),[...primary,...standaloneTools].sort())
})
test('Every non-detail page remains discoverable after navigation consolidation',()=>{
 for(const module of modules.filter(m=>!m.path.includes(':'))){assert.ok(isNavigableModule(module),module.path)}
 for(const family of toolFamilies)for(const path of [family.root,...family.tools])assert.ok(modules.some(m=>m.path===path),path)
})
test('Related tools never advertise an unavailable action',()=>{
 const viewInventory=p=>p==='inventory.view'
 assert.deepEqual(toolsForPath('/advanced-stock/stock-request',viewInventory).map(m=>m.path),['/inventory','/advanced-stock'])
 assert.equal(toolsForPath('/advanced-stock/stock-request',()=>false).length,0)
 assert.ok(!toolsForPath('/users',p=>p==='users.view').some(m=>m.path==='/enterprise-access'))
})
test('Specialist-only users retain an entry even when their parent section is forbidden',()=>{
 const can=p=>p==='kpi.view'
 assert.equal(toolsForPath('/kpi',can).some(m=>m.path==='/reports'),false)
 assert.equal(secondaryNavigation(can).some(m=>m.path==='/kpi'),true)
 assert.equal(secondaryNavigation(()=>false).length,0)
 const all=secondaryNavigation(()=>true).map(m=>m.path)
 assert.deepEqual(all,standaloneTools)
})
test('Existing links and detail records resolve to their canonical section',()=>{
 for(const [path,root] of [['/assets/asset-id','/facility-asset-cockpit'],['/asset-passport/asset-id','/facility-asset-cockpit'],['/maintenance-cycle/work-order-id','/corrective'],['/corrective/work_order/id','/corrective'],['/ppm/job/id','/ppm'],['/statements/id','/contracts'],['/procurement/order/id','/procurement']])assert.equal(familyForPath(path)?.root,root,path)
 assert.equal(familyForPath('/unknown'),null)
})
