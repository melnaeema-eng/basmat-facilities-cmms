import test from 'node:test'
import assert from 'node:assert/strict'
import {adoptReferenceCompany} from '../src/lib/adoptReferenceCompany.js'
const reference={name_ar:'مجموعة المجال العربي',name_en:'Al Majal Al Arabi Group',status:'active'}
function client(rows=[]){const calls=[];return {calls,from:()=>({select:()=>({limit:async()=>({data:rows,error:null})})}),rpc:async(name,payload)=>{calls.push({name,payload});return{data:'new-org',error:null}}}}
test('A library reference is provisioned as a bilingual maintenance organization through the existing permission-checked API',async()=>{
 const api=client();assert.deepEqual(await adoptReferenceCompany(api,reference),{id:'new-org',existing:false})
 assert.equal(api.calls[0].name,'bf36_create_organization');assert.equal(api.calls[0].payload.p_type,'maintenance_contractor')
 assert.equal(api.calls[0].payload.p_name_ar,reference.name_ar);assert.equal(api.calls[0].payload.p_name_en,reference.name_en)
})
test('Reusing a matching bilingual organization never creates a duplicate',async()=>{
 const api=client([{id:'existing',name_en:'  AL MAJAL AL ARABI GROUP ',status:'active',organization_type:'maintenance_contractor'}])
 assert.deepEqual(await adoptReferenceCompany(api,reference),{id:'existing',existing:true});assert.equal(api.calls.length,0)
})
test('Owner, inactive and ambiguous matches require review instead of conversion or duplicate creation',async()=>{
 for(const [rows,message] of [[[{name_ar:reference.name_ar,status:'active',organization_type:'owner'}],'OWNER_PROVIDER_CONFLICT'],[[{name_ar:reference.name_ar,status:'archived'}],'REFERENCE_ORGANIZATION_INACTIVE'],[[{name_ar:reference.name_ar},{name_en:reference.name_en}],'REFERENCE_COMPANY_AMBIGUOUS']]){
  const api=client(rows);await assert.rejects(()=>adoptReferenceCompany(api,reference),{message});assert.equal(api.calls.length,0)
 }
})
test('Archived references cannot provision a company',async()=>{const api=client();await assert.rejects(()=>adoptReferenceCompany(api,{...reference,status:'archived'}),{message:'REFERENCE_COMPANY_INACTIVE'});assert.equal(api.calls.length,0)})
