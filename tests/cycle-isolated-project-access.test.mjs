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
  const before=[];for(const u of [admin,tech,qa,unassigned])for(const k of ['corrective.view','corrective.execute','contracts.manage','costing.manage'])before.push(await can(u,other,k))
  await db.exec(file('../sql/048_APPROVED_ISOLATED_TEST_CYCLE_ACCESS.sql'))

  const after=[];for(const u of [admin,tech,qa,unassigned])for(const k of ['corrective.view','corrective.execute','contracts.manage','costing.manage'])after.push(await can(u,other,k))
  assert.deepEqual(after,before,'Every non-test authorization result is unchanged')
  assert.equal(await can(admin,project,'contracts.manage'),true)
  assert.equal(await can(tech,project,'corrective.execute'),true)
  assert.equal(await can(tech,project,'ppm.execute'),true)
  assert.equal(await can(tech,project,'corrective.approve'),false)
  assert.equal(await can(qa,project,'corrective.approve'),true)
  for(const key of ['costing.manage','finance.manage','inventory.manage','inventory.request'])assert.equal(await can(admin,project,key),false,key)
  assert.equal(await can(unassigned,project,'contracts.manage'),false)
  assert.equal(await scalar('select count(*)::int from bf_acl_organization_permissions'),0)
  assert.equal(await scalar('select count(*)::int from bf_acl_organization_modules'),0)
  assert.equal(await scalar('select count(*)::int from bf_acl_user_roles'),3)
  await q("update private.bf48_test_cycle_access set expires_at=now()-interval '1 second'")
  assert.equal(await can(tech,project,'corrective.execute'),false)
  assert.equal(await can(admin,project,'contracts.manage'),false)
 }finally{await db.close()}
})
