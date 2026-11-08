import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const file=p=>readFileSync(new URL(p,import.meta.url),'utf8')
test('Explicit test-project access stays isolated and preserves every independent ACL gate',async t=>{
 const db=new PGlite(),org=id(10),client=id(11),contract=id(12),project=id(14),other=id(15),admin=id(1),tech=id(2),qa=id(3),unassigned=id(4)
 const q=(s,p=[])=>db.query(s,p),scalar=async(s,p=[])=>Object.values((await q(s,p)).rows[0])[0]
 const can=(u,p,key,site=null)=>scalar('select bf44_user_can($1,$2,$3,$4)',[u,p,key,site])
 try{
  await db.exec(file('./fixtures/cycle-schema.sql'))
  await db.exec('alter table bf35_projects add column project_code text;')
  await db.exec(file('../sql/044_INTEGRATED_MAINTENANCE_CYCLE.sql'))
  for(const [u,name] of [[admin,'melnaeema'],[tech,'Technician'],[qa,'Supervisor'],[unassigned,'Other admin']]){
   await q('insert into auth.users values($1)',[u]);await q("insert into bf_profiles(id,full_name,status,is_super_admin) values($1,$2,'active',$3)",[u,name,[admin,unassigned].includes(u)])
   await q('insert into bf_acl_user_organizations(user_id,organization_id) values($1,$2)',[u,org])
  }
  await q("insert into bf_organizations values($1,'Provider')",[org])
  await q("insert into bf_clients values($1,$2,'TEST ONLY — مالك منشأة التدريب')",[client,org])
  await q("insert into bf_contracts values($1,$2,$3,'TEST-FM-20261108-01')",[contract,org,client])
  await q("insert into bf35_projects(id,organization_id,client_id,contract_id,name,project_code) values($1,$2,$3,$4,'TEST ONLY — دورة وقائية وتصحيحية لجهاز مرافق','PRJ-000021'),($5,$2,$3,$4,'Existing live project','PRJ-REAL')",[project,org,client,contract,other])
  const permissionRoles=[
   [admin,'project_manager',['projects.manage','facilities.work_orders.manage','facilities.work_orders.view','finance.manage']],
   [tech,'technician',['facilities.work_orders.view','facilities.work_orders.execute','facilities.ppm.execute']],
   [qa,'facilities_engineer',['facilities.work_orders.view','facilities.work_orders.review','facilities.ppm.review']]
  ]
  for(const [u,code,keys] of permissionRoles){
   await q("insert into bf_acl_roles(id,organization_id,role_code,module_code) values($1,$2,$3,'facilities')",[u,org,code])
   await q('insert into bf_acl_user_roles(user_id,organization_id,role_id) values($1,$2,$1)',[u,org])
   for(const p of [project,other])await q("insert into bf_acl_user_projects(user_id,organization_id,project_id,module_code) values($1,$2,$3,'shared')",[u,org,p])
   for(const key of keys){
    await q("insert into bf_acl_permissions(permission_key,module_code) values($1,$2) on conflict do nothing",[key,key.startsWith('facilities.')?'facilities':'shared'])
    await q('insert into bf_acl_role_permissions(role_id,permission_key) values($1,$2)',[u,key])
   }
  }
  await q("select set_config('test.user_id',$1,false)",[admin])
  assert.equal(await can(admin,project,'contracts.manage'),false)
  await db.exec(file('../sql/046_PROJECT_SCOPED_CYCLE_ACCESS.sql'))
  await t.test('Only the selected test project gains access; no organization-wide configuration is created',async()=>{
   assert.equal(await can(admin,project,'contracts.manage'),true)
   assert.equal(await can(admin,other,'contracts.manage'),false)
   assert.equal(await can(unassigned,project,'contracts.manage'),false)
   assert.equal(await scalar('select count(*)::int from bf_acl_organization_modules'),0)
   assert.equal(await scalar('select count(*)::int from bf_acl_organization_permissions'),0)
   assert.equal(await scalar('select count(*)::int from bf_acl_user_roles'),3)
   assert.equal(await scalar('select count(*)::int from bf_acl_user_projects'),6)
   assert.equal(await scalar('select count(*)::int from bf44_statements'),0)
   assert.equal(await scalar('select count(*)::int from bf44_certificates'),0)
  })
  await t.test('Deployed execute, review and finance keys retain separation of duties',async()=>{
   assert.equal(await can(tech,project,'corrective.execute'),true)
   assert.equal(await can(tech,project,'ppm.execute'),true)
   assert.equal(await can(tech,project,'corrective.approve'),false)
   assert.equal(await can(tech,project,'corrective.manage'),false)
   assert.equal(await can(qa,project,'corrective.approve'),true)
   assert.equal(await can(qa,project,'ppm.approve'),true)
   assert.equal(await can(qa,project,'corrective.execute'),false)
   assert.equal(await can(admin,project,'costing.manage'),true)
   await q("select set_config('test.user_id',$1,false)",[tech])
   const discovered=await scalar('select bf44_my_project_access()')
   assert.ok(discovered.some(x=>x.permission_key==='corrective.execute'))
   assert.ok(discovered.every(x=>x.project_id===project&&x.organization_id===org))
   assert.ok(discovered.every(x=>!['costing.manage','corrective.approve','corrective.manage'].includes(x.permission_key)))
   await q("select set_config('test.user_id',$1,false)",[admin])
  })
  await t.test('Organization deny, module disable and revoked binding cannot be overridden',async()=>{
   await q("insert into bf_acl_organization_permissions values($1,'facilities.work_orders.execute',false)",[org])
   assert.equal(await can(tech,project,'corrective.execute'),false)
   await q('delete from bf_acl_organization_permissions')
   await q("insert into bf_acl_organization_modules(organization_id,module_code,is_enabled) values($1,'facilities',false)",[org])
   assert.equal(await can(tech,project,'corrective.execute'),false)
   await q('delete from bf_acl_organization_modules')
   await q("insert into bf_acl_project_organizations(project_id,organization_id,module_code,is_active) values($1,$2,'facilities',false)",[project,org])
   assert.equal(await can(tech,project,'corrective.execute'),false)
   await q('delete from bf_acl_project_organizations')
  })
  await t.test('Membership, role, validity and site scope remain mandatory',async()=>{
   await q('update bf_acl_user_organizations set is_active=false where user_id=$1',[tech]);assert.equal(await can(tech,project,'corrective.execute'),false)
   await q('update bf_acl_user_organizations set is_active=true where user_id=$1',[tech])
   await q('update bf_acl_user_roles set is_active=false where user_id=$1',[tech]);assert.equal(await can(tech,project,'corrective.execute'),false)
   await q('update bf_acl_user_roles set is_active=true where user_id=$1',[tech])
   await q('update bf_acl_user_projects set valid_until=current_date-1 where user_id=$1',[tech]);assert.equal(await can(tech,project,'corrective.execute'),false)
   await q('update bf_acl_user_projects set valid_until=null,site_id=$2 where user_id=$1',[tech,id(90)])
   assert.equal(await can(tech,project,'corrective.execute'),false)
   assert.equal(await can(tech,project,'corrective.execute',id(91)),false)
   assert.equal(await can(tech,project,'corrective.execute',id(90)),true)
   await q('update bf_acl_user_projects set site_id=null where user_id=$1',[tech])
  })
  await t.test('Expiry, revocation and changed contract terminate the explicit grant',async()=>{
   await q('update bf44_project_grants set valid_until=current_date-1');assert.equal(await can(tech,project,'corrective.execute'),false)
   await q('update bf44_project_grants set valid_until=current_date+2,is_active=false');assert.equal(await can(tech,project,'corrective.execute'),false)
   await db.exec(file('../sql/046_PROJECT_SCOPED_CYCLE_ACCESS.sql'))
   assert.equal(await scalar('select is_active from bf44_project_grants'),false)
   assert.equal(await scalar('select valid_until=current_date+2 from bf44_project_grants'),true)
   await q('update bf44_project_grants set is_active=true')
   await q('update bf35_projects set contract_id=null where id=$1',[project]);assert.equal(await can(tech,project,'corrective.execute'),false)
   await q('update bf35_projects set contract_id=$2 where id=$1',[project,contract])
  })
  await t.test('Authenticated users cannot issue grants and anonymous callers cannot inspect them',async()=>{
   await db.exec('set role authenticated')
   assert.equal(await scalar('select count(*)::int from bf44_project_grants'),1)
   await assert.rejects(()=>q('update bf44_project_grants set is_active=false'),e=>e.code==='42501')
   await db.exec('reset role;set role anon')
   await assert.rejects(()=>q('select * from bf44_project_grants'),e=>e.code==='42501')
   await db.exec('reset role')
  })
  await t.test('The exact approved test identity is enforced transactionally',async()=>{
   await q("update bf35_projects set name='Real project' where id=$1",[project])
   await assert.rejects(()=>db.exec(file('../sql/046_PROJECT_SCOPED_CYCLE_ACCESS.sql')),/Expected TEST ONLY project/)
   await db.exec('rollback')
   assert.equal(await scalar('select count(*)::int from bf44_project_grants'),1)
  })
 }finally{await db.close()}
})
