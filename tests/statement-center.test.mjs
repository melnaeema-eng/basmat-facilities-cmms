import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {loadStatementCenter} from '../src/lib/statementCenter.js'
test('Statement reader makes one scoped call and never retries the heavy center',async()=>{
 const calls=[];await loadStatementCenter(async(...a)=>{calls.push(a);return {projects:[],statements:[]}},'org');assert.deepEqual(calls,[['bf44_statement_center',{p_org:'org'}]])
 await assert.rejects(()=>loadStatementCenter(async()=>{throw Error('timeout')},'org'),/timeout/)
})
test('Light statement API preserves owner/company scope and rejects anonymous/inactive access',async()=>{
 const db=new PGlite(),id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
 try{
 await db.exec(`create schema auth;create role anon;create role authenticated;
 create table public.actor(id uuid);create function auth.uid() returns uuid language sql stable as 'select id from public.actor limit 1';
 create table public.bf_profiles(id uuid,status text);create table public.bf35_projects(id uuid,organization_id uuid,client_id uuid,contract_id uuid,name text);
 create table public.bf_clients(id uuid,organization_id uuid,name text);create table public.bf_organizations(id uuid,name text);create table public.bf_contracts(id uuid,contract_number text);
 create table public.bf44_policies(project_id uuid,owner_reviewer uuid,consultant_reviewer uuid,status text);
 create table public.bf35_project_sites(project_id uuid,site_id uuid);
 create table public.bf44_statements(id uuid,project_id uuid,statement_number text,period_start date,period_end date,status text,created_at timestamptz);
 create table public.grants(actor uuid,project uuid,permission text);
 create function public.bf35_can_view(uuid) returns boolean language sql stable as $$select exists(select 1 from public.grants where actor=auth.uid() and project=$1 and permission='registry')$$;
 create function public.bf44_staff(uuid,text) returns boolean language sql stable as $$select exists(select 1 from public.grants where actor=auth.uid() and project=$1 and permission=$2)$$;
 create function public.bf44_reviewer(uuid,text) returns boolean language sql stable as $$select public.bf44_staff($1,$2)$$;
 create function public.bf44_view(uuid,uuid default null) returns boolean language sql stable as $$select public.bf44_staff($1,'view')$$;`)
 await db.exec(readFileSync(new URL('../sql/statement_center_read.sql',import.meta.url),'utf8'))
 const q=(s,p=[])=>db.query(s,p),as=async n=>{await db.exec('delete from actor');if(n)await q('insert into actor values($1)',[id(n)])},read=async org=>(await q('select bf44_statement_center($1) data',[id(org)])).rows[0].data
 await q("insert into bf_profiles values($1,'active'),($2,'active'),($3,'inactive'),($4,'active')",[id(1),id(2),id(3),id(4)])
 await q("insert into bf_organizations values($1,'Company'),($2,'Other company')",[id(100),id(101)])
 await q("insert into bf_clients values($1,$2,'Owner'),($3,$4,'Other owner')",[id(200),id(100),id(201),id(101)])
 await q("insert into bf35_projects values($1,$2,$3,null,'Project'),($4,$5,$6,null,'Other project')",[id(300),id(100),id(200),id(301),id(101),id(201)])
 await q("insert into bf44_policies values($1,$2,null,'draft')",[id(300),id(2)])
 await q("insert into grants values($1,$2,'costing.manage'),($3,$2,'owner'),($4,$5,'registry')",[id(1),id(300),id(2),id(4),id(100)])
 await q("insert into bf44_statements values($1,$2,'ST-1',current_date,current_date,'draft',now()),($3,$4,'OTHER',current_date,current_date,'draft',now())",[id(400),id(300),id(401),id(301)])
 await as(1);let d=await read(100);assert.equal(d.projects.length,1);assert.equal(d.projects[0].can_finance,true);assert.equal(d.projects[0].can_activate,false);assert.equal(d.statements[0].statement_number,'ST-1')
 assert.equal((await read(101)).statements.length,0)
 await as(2);d=await read(100);assert.equal(d.projects[0].can_activate,true);assert.equal(d.projects[0].can_finance,false);assert.equal(d.projects[0].policy.status,'draft');assert.equal(d.statements.length,1)
 await as(4);d=await read(100);assert.equal(d.projects.length,1);assert.equal(d.statements.length,0);assert.equal(d.projects[0].can_finance,false)
 await as(3);await assert.rejects(()=>read(100),/Authentication required/);await as(null);await assert.rejects(()=>read(100),/Authentication required/)
 assert.equal((await q("select has_function_privilege('anon','bf44_statement_center(uuid)','execute') allowed")).rows[0].allowed,false)
 }finally{await db.close()}
})
