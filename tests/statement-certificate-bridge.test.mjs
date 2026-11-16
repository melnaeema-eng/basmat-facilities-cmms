import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
test('Existing certificate registration preserves approval, issue identity and closed work; enforces project/date/role scope',async()=>{
 const db=new PGlite(),id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
 try{
 await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create table public.actor(id uuid);create function auth.uid() returns uuid language sql stable as 'select id from public.actor limit 1';`)
 await db.exec(readFileSync(new URL('./fixtures/notification-schema.sql',import.meta.url),'utf8'))
 await db.exec(`create table public.bf35_project_sites(project_id uuid,site_id uuid,organization_id uuid,client_id uuid);create table public.grants(actor uuid,project uuid);create function public.bf44_staff(uuid,text) returns boolean language sql stable as $$select exists(select 1 from public.grants where actor=auth.uid() and project=$1 and $2='costing.manage')$$;`)
 await db.exec(readFileSync(new URL('../sql/statement_existing_certificate_bridge.sql',import.meta.url),'utf8'))
 const q=(s,p=[])=>db.query(s,p),actor=async n=>{await db.exec('delete from actor');if(n)await q('insert into actor values($1)',[id(n)])}
 await q("insert into bf_profiles(id,status) values($1,'active'),($2,'active')",[id(1),id(2)])
 await q("insert into grants values($1,$2)",[id(1),id(300)])
 await q("insert into bf35_projects(id,organization_id,client_id,contract_id) values($1,$2,$3,$4)",[id(300),id(100),id(200),id(400)])
 await q("insert into bf44_policies(project_id,contract_id,owner_reviewer,status) values($1,$2,$3,'active')",[id(300),id(400),id(2)])
 await q("insert into bf44_statements(id,project_id,status,period_start,period_end) values($1,$2,'draft','2026-11-16','2026-11-16')",[id(500),id(300)])
 await q("insert into bf35_project_sites values($1,$2,$3,$4)",[id(300),id(600),id(100),id(200)])
 await q("insert into bf_assets(id,organization_id,client_id,site_id) values($1,$2,$3,$4)",[id(700),id(100),id(200),id(600)])
 await q("insert into bf_work_orders(id,organization_id,client_id,site_id,asset_id,contract_id,status,work_order_number) values($1,$2,$3,$4,$5,$6,'closed','WO-TEST')",[id(800),id(100),id(200),id(600),id(700),id(400)])
 await q("insert into bf11_approvals(id,organization_id,client_id,entity_type,entity_id,reviewer_type,status,round,requested_at,decided_at) values($1,$2,$3,'work_order',$4,'owner','approved',1,'2026-11-16T08:00Z','2026-11-16T09:00Z')",[id(900),id(100),id(200),id(800)])
 await q("insert into bf13_documents(id,organization_id,client_id,entity_type,entity_id,document_type,status,document_number,generated_at,generated_by,snapshot,snapshot_hash) values($1,$2,$3,'work_order',$4,'technical_report','final','REPORT-1','2026-11-16T08:30Z',$5,'{}','reporthash'),($6,$2,$3,'approval',$7,'approval_certificate','final','DOC-TEST','2026-11-16T10:00Z',$5,'{\"original\":true}','originalhash')",[id(901),id(100),id(200),id(800),id(1),id(902),id(900)])
 const candidates=async()=> (await q('select bf44_statement_documents($1) d',[id(500)])).rows[0].d
 await actor(2);assert.equal((await candidates()).length,0);await assert.rejects(()=>q('select bf44_register_statement_document($1,$2)',[id(500),id(902)]),/permission/)
 await actor(1);assert.equal((await candidates()).length,1)
 await q("update bf44_statements set period_end='2026-11-15'");assert.equal((await candidates()).length,0);await q("update bf44_statements set period_end='2026-11-16'")
 await q("update bf_work_orders set contract_id=$1",[id(999)]);assert.equal((await candidates()).length,0);await q("update bf_work_orders set contract_id=$1",[id(400)])
 await q("update bf11_approvals set status='pending'");assert.equal((await candidates()).length,0);await q("update bf11_approvals set status='approved'")
 await q("update bf13_documents set status='void' where id=$1",[id(902)]);assert.equal((await candidates()).length,0);await q("update bf13_documents set status='final' where id=$1",[id(902)])
 await q("insert into bf13_documents(id,organization_id,client_id,entity_type,entity_id,document_type,status,generated_at) values($1,$2,$3,'work_order',$4,'technical_report','final','2026-11-16T12:00Z')",[id(903),id(100),id(200),id(800)])
 const registered=await q('select bf44_register_statement_document($1,$2) id',[id(500),id(902)]);assert.equal(registered.rows[0].id,id(902));assert.equal((await candidates()).length,0)
 const cert=(await q('select * from bf44_certificates')).rows[0];assert.equal(cert.certificate_number,'DOC-TEST');assert.equal(cert.report_id,id(901));assert.equal(cert.snapshot_hash,'originalhash');assert.deepEqual(cert.snapshot,{original:true});assert.equal(cert.issued_at.toISOString(),'2026-11-16T10:00:00.000Z')
 assert.equal((await q('select status from bf_work_orders')).rows[0].status,'closed');assert.equal((await q('select status from bf11_approvals')).rows[0].status,'approved')
 assert.equal((await q('select bf44_register_statement_document($1,$2) id',[id(500),id(902)])).rows[0].id,id(902));assert.equal((await q('select count(*)::int n from bf44_certificates')).rows[0].n,1)
 assert.equal((await q('select count(*)::int n from bf44_statement_lines')).rows[0].n,0)
 await actor(null);await assert.rejects(()=>q('select bf44_register_statement_document($1,$2)',[id(500),id(902)]),/Authentication/)
 }finally{await db.close()}
})
