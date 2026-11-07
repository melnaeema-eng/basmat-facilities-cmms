import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {modules,permitted,moduleForPath} from '../src/config/modules.js'
import {maintenanceStage,monthRange} from '../src/lib/workspaceCore.js'
test('Every registered page exists and every operational route has a permission',()=>{
 assert.equal(new Set(modules.map(m=>m.path)).size,modules.length)
 for(const m of modules){assert.ok(existsSync(new URL(`../src/pages/${m.page}.jsx`,import.meta.url)),m.path);if(m.path!=='/')assert.ok(m.permission,m.path)}
 for(const path of ['/users','/technician-execution','/approvals','/documents','/owners','/work-orders'])assert.ok(modules.find(m=>m.path===path),path)
 assert.equal(modules.some(m=>m.path==='/medical'),false)
})
test('Navigation and route access agree for corrective-only, PPM-only and unassigned accounts',()=>{
 const hub=modules.find(m=>m.path==='/work-orders')
 assert.equal(permitted(hub,p=>p==='ppm.view'),true)
 assert.equal(permitted(hub,p=>p==='corrective.view'),true)
 assert.equal(permitted(hub,()=>false),false)
 const execution=modules.find(m=>m.path==='/technician-execution')
 assert.equal(permitted(execution,p=>p==='corrective.view'),false)
 assert.equal(permitted(execution,p=>p==='maintenance.execute'),true)
})
test('Existing route entry points remain registered or have explicit redirects',()=>{
 const original=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
 assert.match(original,/path="\/clients" element=\{<Navigate to="\/owners"/)
 for(const path of ['/corrective/:kind/:id','/ppm/:kind/:id','/assets/:id','/inventory/request/:id','/project-setup'])assert.ok(modules.find(m=>m.path===path),path)
 assert.equal(moduleForPath('/corrective/work_order/123').path,'/corrective')
})
test('Execution completion stays in review until approval and closeout',()=>{
 assert.equal(maintenanceStage('completed'),'review')
 assert.equal(maintenanceStage('approved'),'closeout')
 assert.equal(maintenanceStage('closed'),'closed')
 assert.equal(maintenanceStage('cancelled'),'cancelled')
})
test('Dashboard month follows Riyadh at UTC month and year boundaries',()=>{
 assert.deepEqual(monthRange(new Date('2026-11-30T22:00:00Z')),{start:'2026-12-01',end:'2027-01-01'})
 assert.deepEqual(monthRange(new Date('2026-12-31T22:00:00Z')),{start:'2027-01-01',end:'2027-02-01'})
})
