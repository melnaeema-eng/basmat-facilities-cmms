import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';import {renderWorkflowMail} from '../supabase/functions/bf-workflow-mail/render.mjs';
test('Email renderer escapes record text and permits only the two application origins',()=>{const j={title:'<script>unsafe</script>',action_ar:'راجع الطلب',action_en:'Review',url:'https://facilities.basmat-alnawabig.com.sa/statements/id'};const r=renderWorkflowMail(j);assert(!r.html.includes('unsafe'));assert(!r.html.includes('statements/id'));assert(!r.text.includes('statements/id'));assert(r.html.includes('/notifications'));assert(!r.subject.includes('unsafe'));assert(!r.html.includes('<script>'));assert.throws(()=>renderWorkflowMail({...j,url:'https://attacker.example/'}),/Invalid/);assert.throws(()=>renderWorkflowMail({...j,url:'https://user:pass@facilities.basmat-alnawabig.com.sa/'}),/Invalid/)})
test('Workflow email recipient scope, independent reviews, deduplication, leases and retry acknowledgement',async()=>{
 const db=new PGlite(),id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 try{
 await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create role service_role;create table public.actor(id uuid);create function auth.uid() returns uuid language sql stable as $$select id from public.actor limit 1$$;`);
 await db.exec(readFileSync(new URL('./fixtures/notification-schema.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('./fixtures/execution-package-schema.sql',import.meta.url),'utf8'));
 await db.exec(`alter table bf_profiles add primary key(id);create table public.bf_asset_categories(id uuid,code text);create table public.bf_acl_user_organizations(user_id uuid,organization_id uuid,is_active boolean);create table public.test_grants(user_id uuid,scope uuid,permission text);
 create function public.bf44_user_can(uuid,uuid,text,uuid default null) returns boolean language sql stable as $$select exists(select 1 from public.test_grants where user_id=$1 and scope=$2 and permission=$3)$$;
 create function public.bf44_reviewer_eligible(uuid,uuid,text) returns boolean language sql stable as $$select public.bf44_user_can($1,$2,$3,null)$$;
 create function public.bf_acl_user_is_owner(uuid,uuid,uuid) returns boolean language sql stable as $$select public.bf44_user_can($1,$3,'owner',null)$$;
 create function public.bf_acl_user_can_client(uuid,uuid,uuid) returns boolean language sql stable as $$select public.bf44_user_can($1,$3,'view',null)$$;
 create function public.bf_acl_legacy_can(uuid,text,uuid) returns boolean language sql stable as $$select public.bf44_user_can($3,$1,$2,null)$$;
 create function public.bf61_user_represents(uuid,uuid) returns boolean language sql stable as $$select false$$;`);
 await db.exec(readFileSync(new URL('../sql/workflow_email_core.sql',import.meta.url),'utf8'));
 const dispatcher=readFileSync(new URL('../sql/workflow_email_dispatch.sql',import.meta.url),'utf8');
 await db.exec(`create function private.bf_mail_token(text) returns boolean language sql as $$select $1='test-runner-token'$$;`+dispatcher.slice(dispatcher.indexOf('create or replace function public.bf_mail_claim'),dispatcher.indexOf('create or replace function private.bf_mail_tick')));
 const q=(s,p=[])=>db.query(s,p),grant=async(u,scope,perm)=>q('insert into test_grants values($1,$2,$3)',[id(u),id(scope),perm]);
 await q("insert into bf_profiles(id,email,status) values($1,'company@example.com','active'),($2,'owner@example.com','active'),($3,'other@example.com','active')",[id(1),id(2),id(3)]);
 await q('insert into bf_acl_user_organizations values($1,$2,true),($3,$2,true),($4,$5,true)',[id(1),id(100),id(2),id(3),id(999)]);
 await q("insert into bf35_projects(id,organization_id,client_id,name) values($1,$2,$3,'Project')",[id(300),id(100),id(200)]);
 for(const u of [1,2])await grant(u,200,'view');await grant(1,300,'costing.manage');await grant(2,300,'owner');await grant(2,300,'costing.manage');
 await q("insert into bf44_policies(project_id,owner_reviewer,status,prepared_at) values($1,$2,'draft',now())",[id(300),id(2)]);
 await q("select private.bf_mail_expand('policy',$1)",[id(300)]);await q("select private.bf_mail_expand('policy',$1)",[id(300)]);
 assert.deepEqual((await q('select recipient from private.bf_mail_outbox')).rows.map(x=>x.recipient),[id(2)]);
 await q("insert into bf44_statements(id,project_id,statement_number,status,created_at,submitted_by,submitted_at) values($1,$2,'ST-TEST','owner_review',now(),$3,now())",[id(500),id(300),id(1)]);
 await q("select private.bf_mail_expand('statement',$1)",[id(500)]);assert.equal((await q("select count(*)::int n from private.bf_mail_outbox where kind='statement'")).rows[0].n,1);
 await q("update bf44_statements set status='rejected'");await q("select private.bf_mail_expand('statement',$1)",[id(500)]);
 assert.deepEqual((await q("select recipient from private.bf_mail_outbox where kind='statement' and state='rejected'")).rows.map(x=>x.recipient),[id(1)]);
 await q("insert into bf_maintenance_execution_packages(id,organization_id,technician_id,status,domain,updated_at) values($1,$2,null,'assigned','medical',now())",[id(600),id(100)]);
 await q("select private.bf_mail_expand('package',$1)",[id(600)]);assert.equal((await q("select count(*)::int n from private.bf_mail_outbox where kind='package'")).rows[0].n,0);
 await q('update bf_maintenance_execution_packages set technician_id=$1',[id(1)]);await q("select private.bf_mail_expand('package',$1)",[id(600)]);
 assert.equal((await q("select url from private.bf_mail_outbox where kind='package'")).rows[0].url,'https://medical.basmat-alnawabig.com.sa/technician-execution');
 await q('update bf44_statements set submitted_by=$1,status=\'owner_review\'',[id(2)]);await q("select private.bf_mail_expand('statement',$1)",[id(500)]);assert.equal((await q("select count(*)::int n from private.bf_mail_outbox where kind='statement' and state='owner_review'")).rows[0].n,1);
 await db.exec('update private.bf_mail_events set processed_at=now()');
 await assert.rejects(()=>q("select bf_mail_claim('bad-token',10)"),/authentication/);
 let jobs=(await q("select bf_mail_claim('test-runner-token',10) jobs")).rows[0].jobs;assert(jobs.length>0);const job=jobs[0];
 assert.equal((await q("select bf_mail_claim('test-runner-token',10) jobs")).rows[0].jobs.length,0);
 await q("select bf_mail_result('test-runner-token',$1,$2,false,null,'temporary provider error')",[job.id,job.lease]);assert.equal((await q('select status from private.bf_mail_outbox where id=$1',[job.id])).rows[0].status,'queued');
 await q('update private.bf_mail_outbox set available_at=now() where id=$1',[job.id]);const retried=(await q("select bf_mail_claim('test-runner-token',10) jobs")).rows[0].jobs.find(x=>x.id===job.id);assert(retried);assert.notEqual(retried.lease,job.lease);
 await q("select bf_mail_result('test-runner-token',$1,$2,true,'old-ack',null)",[job.id,job.lease]);assert.equal((await q('select status from private.bf_mail_outbox where id=$1',[job.id])).rows[0].status,'sending');
 await q("select bf_mail_result('test-runner-token',$1,$2,true,'provider-id',null)",[job.id,retried.lease]);assert.equal((await q('select status from private.bf_mail_outbox where id=$1',[job.id])).rows[0].status,'sent');
 assert.equal((await q("select has_function_privilege('authenticated','bf_mail_claim(text,integer)','execute') allowed")).rows[0].allowed,false);
 }finally{await db.close()}
})
