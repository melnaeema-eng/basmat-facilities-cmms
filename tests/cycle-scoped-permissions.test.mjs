import test from 'node:test'
import assert from 'node:assert/strict'
import {hasScopedCyclePermission} from '../src/lib/scopedCyclePermissions.js'
test('A project entitlement never becomes permission on another project or organization',()=>{
 const rows=[{organization_id:'org',project_id:'test',permission_key:'corrective.execute'}]
 assert.equal(hasScopedCyclePermission(rows,'corrective.execute',{organization_id:'org',project_id:'test'}),true)
 assert.equal(hasScopedCyclePermission(rows,'corrective.execute',{organization_id:'org',project_id:'real'}),false)
 assert.equal(hasScopedCyclePermission(rows,'corrective.execute',{organization_id:'other',project_id:'test'}),false)
 assert.equal(hasScopedCyclePermission(rows,'corrective.approve',{organization_id:'org',project_id:'test'}),false)
})
test('A site assignment cannot authorize whole-project or other-site actions',()=>{
 const rows=[{organization_id:'org',project_id:'test',site_id:'site',permission_key:'corrective.execute'}]
 assert.equal(hasScopedCyclePermission(rows,'corrective.execute',{project_id:'test'}),false)
 assert.equal(hasScopedCyclePermission(rows,'corrective.execute',{project_id:'test',site_id:'other'}),false)
 assert.equal(hasScopedCyclePermission(rows,'corrective.execute',{project_id:'test',site_id:'site'}),true)
})
