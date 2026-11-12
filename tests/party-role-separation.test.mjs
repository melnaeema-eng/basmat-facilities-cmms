import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('Owner and maintenance-provider identities remain exclusive across records and links',async t=>{
 const db=new PGlite()
 try{
  await db.exec(`create schema private;create role anon;create role authenticated;
   create table bf_organizations(id uuid primary key,name text,name_ar text,name_en text,registration_no text,organization_type text,status text default 'active');
   create table bf_clients(id uuid primary key,organization_id uuid,name text,party_role text default 'owner',status text default 'active');
   create table bf_med_company_library(id uuid primary key,name_ar text,name_en text,registration_no text,company_type text,status text default 'active');
   create table bf_med_service_companies(id uuid primary key,name_ar text,name_en text,company_type text,status text default 'active');
   create table bf_contracts(id uuid primary key,organization_id uuid,client_id uuid,title text,status text default 'active');
   create table bf35_projects(id uuid primary key,organization_id uuid,client_id uuid,name text,status text default 'active');
   create table bf_med_company_tenant_links(library_company_id uuid,organization_id uuid,status text default 'active');
   create table bf_med_project_service_companies(id uuid primary key,organization_id uuid,project_id uuid,company_id uuid,owner_organization_id uuid,status text default 'active');
   create table bf_med_tenant_companies(organization_id uuid primary key,status text default 'active');`)
  await db.query("insert into bf_organizations(id,name,organization_type) values($1,'Owner A','owner'),($2,'Provider A','maintenance_contractor'),($3,'Legacy unclassified',null)",[id(1),id(2),id(3)])
  await db.query("insert into bf_clients(id,organization_id,name) values($1,$2,'Owner A')",[id(4),id(2)])
  await db.query('insert into bf_contracts(id,organization_id,client_id) values($1,$2,$3)',[id(5),id(3),id(4)])
  await db.exec(readFileSync(new URL('../sql/054_OWNER_PROVIDER_ROLE_SEPARATION.sql',import.meta.url),'utf8'))
  const conflict=fn=>assert.rejects(fn,e=>e.code==='23514'&&e.message.includes('OWNER_PROVIDER_CONFLICT'))
  await t.test('provider cannot be inserted into owner records (including case and space aliases)',async()=>{
   await conflict(()=>db.query("insert into bf_clients(id,organization_id,name) values($1,$2,'  PROVIDER   A  ')",[id(10),id(2)]))
  })
  await t.test('owner cannot be inserted into either maintenance catalog',async()=>{
   await conflict(()=>db.query("insert into bf_med_company_library(id,name_en) values($1,'Owner A')",[id(11)]))
   await conflict(()=>db.query("insert into bf_med_service_companies(id,name_en) values($1,'Owner A')",[id(12)]))
  })
  await t.test('registration number also blocks different name aliases',async()=>{
   await db.query("update bf_organizations set registration_no='CR-123' where id=$1",[id(1)])
   await conflict(()=>db.query("insert into bf_med_company_library(id,name_en,registration_no) values($1,'Different spelling','cr-123')",[id(13)]))
  })
  await t.test('same-role aliases are allowed; role changes and blanking/reclassifying are blocked',async()=>{
   await db.query("insert into bf_med_service_companies(id,name_en) values($1,'Provider A')",[id(14)])
   await conflict(()=>db.query("update bf_organizations set organization_type='owner' where id=$1",[id(2)]))
   await db.query("update bf_organizations set organization_type=null where id=$1",[id(2)])
   await conflict(()=>db.query("update bf_organizations set organization_type='owner' where id=$1",[id(2)]))
  })
  await t.test('same-entity owner/provider cannot be linked through project service records',async()=>{
   await conflict(()=>db.query('insert into bf_med_project_service_companies(id,organization_id,company_id,owner_organization_id) values($1,$2,$3,$2)',[id(15),id(2),id(14)]))
  })
  await t.test('an owner organization cannot be initialized as a provider tenant',async()=>{
   await conflict(()=>db.query('insert into bf_med_tenant_companies(organization_id) values($1)',[id(1)]))
   await conflict(()=>db.query('insert into bf_med_company_tenant_links(organization_id,library_company_id) values($1,$2)',[id(1),id(13)]))
  })
  await t.test('a valid contract uses different parties and existing unclassified provider stays protected',async()=>{
   await db.query('insert into bf_contracts(id,organization_id,client_id) values($1,$2,$3)',[id(16),id(2),id(4)])
   await conflict(()=>db.query("insert into bf_clients(id,organization_id,name) values($1,$2,'Legacy unclassified')",[id(17),id(2)]))
   await db.query("update bf_contracts set title='Metadata update' where id=$1",[id(5)])
  })
  await t.test('failed claims roll back atomically and helper API is not granted to application roles',async()=>{
   assert.equal((await db.query("select count(*)::int n from private.bf54_party_role_claims where identity_key='library:'||$1",[id(13)])).rows[0].n,0)
   assert.equal((await db.query("select has_function_privilege('authenticated','private.bf54_claim_party(jsonb,text,text)','execute') allowed")).rows[0].allowed,false)
   assert.equal((await db.query("select has_table_privilege('authenticated','private.bf54_party_role_claims','select') allowed")).rows[0].allowed,false)
  })
 }finally{await db.close()}
})
