import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {loadCycleCenter} from '../src/lib/cycleCenter.js'

test('Center uses the unique API and preserves the selected organization', async () => {
 const calls=[]
 const result=await loadCycleCenter(async(name,args)=>{calls.push([name,args]);return {projects:[]}},'provider')
 assert.deepEqual(calls,[['bf44_cycle_center',{p_org:'provider'}]])
 assert.deepEqual(result,{projects:[]})
})
test('An older non-conflicting installation remains usable during rollout', async () => {
 const calls=[]
 const result=await loadCycleCenter(async(name,args)=>{
  calls.push([name,args]);if(name==='bf44_cycle_center')throw {code:'PGRST202'}
  return {version:44}
 },'')
 assert.deepEqual(result,{version:44})
 assert.deepEqual(calls,[['bf44_cycle_center',{p_org:null}],['bf44_center',{p_org:null}]])
})
test('The observed overload produces a specific repair rather than an empty center', async () => {
 await assert.rejects(()=>loadCycleCenter(async name=>{throw {code:name==='bf44_cycle_center'?'PGRST202':'PGRST203'}},null),error=>error.code==='BF44_CENTER_OVERLOAD'&&error.cause.code==='PGRST203')
})
test('Denied access and transport failures are never retried on a legacy endpoint', async () => {
 for(const code of ['42501','PGRST301','NETWORK_ERROR']){
  let count=0;const failure={code,message:'failed'}
  await assert.rejects(()=>loadCycleCenter(async()=>{count++;throw failure},null),error=>error===failure)
  assert.equal(count,1)
 }
})

const repair=readFileSync(new URL('../sql/045_MAINTENANCE_CENTER_RPC_COMPATIBILITY.sql',import.meta.url),'utf8')
test('Manual repair preserves the exact function, legacy overload, grants and data',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`create role anon;create role authenticated;
   create table preserved_rows(id integer);insert into preserved_rows values(1);
   create function public.bf44_center(p_org uuid default null) returns jsonb
    language sql stable security definer set search_path='' as $$select jsonb_build_object('version',44,'org',p_org)$$;
   revoke all on function public.bf44_center(uuid) from public;
   grant execute on function public.bf44_center(uuid) to authenticated;
   create function public.bf44_center(p_org uuid default null,p_client uuid default null,p_contract uuid default null,p_limit integer default 200)
    returns jsonb language sql stable as $$select '{"legacy":true}'::jsonb$$;
   revoke all on function public.bf44_center(uuid,uuid,uuid,integer) from public;
   grant execute on function public.bf44_center(uuid,uuid,uuid,integer) to authenticated;`)
  await assert.rejects(()=>db.query('select public.bf44_center(null::uuid)'),error=>error.code==='42725')
  const meta=await db.query("select oid,proowner,prosrc,prosecdef,proconfig,proacl from pg_proc where oid='public.bf44_center(uuid)'::regprocedure")
  const legacy=await db.query("select oid,proacl from pg_proc where oid='public.bf44_center(uuid,uuid,uuid,integer)'::regprocedure")
  await db.exec(repair);await db.exec(repair)
  const after=await db.query("select oid,proowner,prosrc,prosecdef,proconfig,proacl from pg_proc where oid='public.bf44_cycle_center(uuid)'::regprocedure")
  assert.deepEqual(after.rows,meta.rows)
  assert.deepEqual((await db.query("select oid,proacl from pg_proc where oid='public.bf44_center(uuid,uuid,uuid,integer)'::regprocedure")).rows,legacy.rows)
  assert.equal((await db.query('select count(*)::int as n from preserved_rows')).rows[0].n,1)
  await db.exec('set role authenticated')
  assert.deepEqual((await db.query('select public.bf44_cycle_center(null::uuid) as value')).rows[0].value,{version:44,org:null})
  assert.deepEqual((await db.query('select public.bf44_center(null::uuid,null::uuid,null::uuid,10) as value')).rows[0].value,{legacy:true})
  await db.exec('reset role;set role anon')
  await assert.rejects(()=>db.query('select public.bf44_cycle_center(null::uuid)'),error=>error.code==='42501')
 }finally{await db.close()}
})
test('Manual repair aborts if the required integrated function is absent',async()=>{
 const db=new PGlite()
 try{
  await db.exec('create role anon;create role authenticated;')
  await assert.rejects(()=>db.exec(repair),/Install integrated maintenance SQL 044 first/)
  await db.exec('rollback')
  assert.equal((await db.query("select to_regprocedure('public.bf44_cycle_center(uuid)') as endpoint")).rows[0].endpoint,null)
 }finally{await db.close()}
})
