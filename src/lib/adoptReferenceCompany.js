const normalize=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase()
export async function adoptReferenceCompany(client,reference){
 if(reference?.status!=='active')throw new Error('REFERENCE_COMPANY_INACTIVE')
 const aliases=[reference.name_ar,reference.name_en].map(normalize).filter(Boolean)
 if(!aliases.length)throw new Error('REFERENCE_COMPANY_NAME_REQUIRED')
 const {data:rows,error}=await client.from('bf_organizations').select('id,name,name_ar,name_en,status,organization_type').limit(1000)
 if(error)throw error
 const matches=(rows||[]).filter(row=>[row.name,row.name_ar,row.name_en].some(name=>aliases.includes(normalize(name))))
 if(matches.length>1)throw new Error('REFERENCE_COMPANY_AMBIGUOUS')
 if(matches.length){
  const row=matches[0]
  if(row.organization_type==='owner')throw new Error('OWNER_PROVIDER_CONFLICT')
  if(row.status!=='active')throw new Error('REFERENCE_ORGANIZATION_INACTIVE')
  return {id:row.id,existing:true}
 }
 const {data,error:writeError}=await client.rpc('bf36_create_organization',{
  p_name_ar:reference.name_ar||'',p_name_en:reference.name_en||'',p_type:'maintenance_contractor',
  p_registration_no:null,p_vat_no:null,p_email:null,p_phone:null,p_city:null,p_address:null
 })
 if(writeError)throw writeError
 return {id:data,existing:false}
}
