export const activeCatalog = row => row && row.status !== 'archived' && row.status !== 'inactive' && row.is_active !== false
export const normalized = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim()
export const recordName = (row, lang='en') => (lang==='ar' ? row?.name_ar||row?.name||row?.name_en : row?.name_en||row?.name||row?.name_ar) || row?.code || '—'
export function catalogTypes(data, query='', system='') {
 const makers=new Map((data?.manufacturers||[]).filter(activeCatalog).map(m=>[m.id,m]))
 const grouped=new Map()
 for(const o of (data?.options||[]).filter(activeCatalog)){
  if(!grouped.has(o.asset_type_id))grouped.set(o.asset_type_id,[])
  grouped.get(o.asset_type_id).push({...o,manufacturer:makers.get(o.manufacturer_id)})
 }
 const words=normalized(query).split(' ').filter(Boolean)
 return (data?.types||[]).filter(activeCatalog).map(t=>({...t,options:grouped.get(t.id)||[]})).filter(t=>{
  const text=normalized([t.code,t.name_ar,t.name_en,t.system_code,...t.options.flatMap(o=>[o.model_family,o.manufacturer?.name,o.manufacturer?.short_name])].join(' '))
  return (!system||t.system_code===system)&&words.every(w=>text.includes(w))
 })
}
export function templatesForSelection(data, {type,manufacturer,option}) {
 return (data?.templates||[]).filter(activeCatalog).filter(t=>t.asset_type_id===type?.id && (!t.manufacturer_id||t.manufacturer_id===manufacturer?.id) && (!t.option_id||t.option_id===option?.id) && (!t.model_family||normalized(t.model_family)===normalized(option?.model_family)))
}
export function assetsInProject(assets, organizationId, projectId, links) {
 const sites=new Set((links||[]).filter(l=>l.project_id===projectId&&l.organization_id===organizationId).map(l=>l.site_id))
 return (assets||[]).filter(a=>a.status!=='archived'&&(!organizationId||a.organization_id===organizationId)&&(!projectId||sites.has(a.site_id)))
}
