import test from 'node:test'
import assert from 'node:assert/strict'
import {catalogTypes,templatesForSelection,assetsInProject} from '../src/lib/facilitiesProduct.js'
import {modules} from '../src/config/modules.js'
const type={id:'ahu',name_ar:'وحدة مناولة الهواء',name_en:'Air Handling Unit',system_code:'HVAC',status:'active'}
const data={types:[type,{...type,id:'archived',status:'archived'}],manufacturers:[{id:'brand',name:'Träne',status:'active'}],options:[{id:'m1',asset_type_id:'ahu',manufacturer_id:'brand',model_family:'CSAA 30',status:'active'},{id:'off',asset_type_id:'ahu',manufacturer_id:'brand',model_family:'Retired',status:'archived'}]}
test('Facilities catalog searches brand and model across the full catalog, accent insensitive',()=>{
 assert.equal(catalogTypes(data,'trane csaa')[0].id,'ahu')
 assert.equal(catalogTypes(data,'CSAA','ELECTRICAL').length,0)
 assert.equal(catalogTypes(data,'Retired').length,0)
 assert.equal(catalogTypes(data,'مناولة الهواء').length,1)
})
test('Maintenance selection excludes another brand, option, model family and inactive template',()=>{
 const selection={type,manufacturer:{id:'brand'},option:data.options[0]}
 const templates=[{id:'generic',asset_type_id:'ahu'},{id:'correct',asset_type_id:'ahu',manufacturer_id:'brand',model_family:'CSAA 30'},{id:'other-model',asset_type_id:'ahu',model_family:'Other'},{id:'other-brand',asset_type_id:'ahu',manufacturer_id:'other'},{id:'other-option',asset_type_id:'ahu',option_id:'m2'},{id:'inactive',asset_type_id:'ahu',status:'inactive'}]
 assert.deepEqual(templatesForSelection({templates},selection).map(t=>t.id),['generic','correct'])
})
test('Project asset filter preserves company and exact site membership',()=>{
 const assets=[{id:'yes',organization_id:'org',site_id:'site'},{id:'other-org',organization_id:'other',site_id:'site'},{id:'other-site',organization_id:'org',site_id:'elsewhere'},{id:'archived',organization_id:'org',site_id:'site',status:'archived'}]
 const links=[{project_id:'project',organization_id:'org',site_id:'site'},{project_id:'project',organization_id:'other',site_id:'elsewhere'}]
 assert.deepEqual(assetsInProject(assets,'org','project',links).map(a=>a.id),['yes'])
 assert.equal(assetsInProject(assets,'org','missing',links).length,0)
})
test('Matching Medical primary sections retain Facilities routes and permissions',()=>{
 for(const path of ['/facility-asset-cockpit','/asset-library','/corrective','/ppm','/approvals','/documents','/notifications','/project-setup','/contracts','/users','/roles-permissions','/inventory','/procurement','/reports','/work-orders','/soft-fm']) assert.ok(modules.some(m=>m.path===path&&m.permission),path)
 assert.equal(modules.find(m=>m.path==='/asset-library').page,'FacilitiesLibrary')
 assert.equal(modules.find(m=>m.path==='/library-admin').page,'MasterAssetLibrary')
})
