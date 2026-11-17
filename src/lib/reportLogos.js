import {ownerLogoSource} from './ownerLogo.js'
export function completeReportLogos(brand={},owner,company){
 return {...brand,owner_logo_data:ownerLogoSource(brand.owner_logo_data)||ownerLogoSource(owner?.logo_url),contractor_logo_data:ownerLogoSource(brand.contractor_logo_data)||ownerLogoSource(company?.logo_url)}
}
export function archivedReportLogos(run,directory){
 const contract=directory?.contracts?.find(c=>c.id===run.contract_id&&c.organization_id===run.organization_id)
 const owner=directory?.clients?.find(c=>c.id===contract?.client_id&&c.organization_id===run.organization_id)
 const company=directory?.organizations?.find(c=>c.id===run.organization_id)
 return completeReportLogos(run.branding_snapshot||{},owner,company)
}
export async function waitForReportImages(node,timeout=8000){
 await Promise.all([...node.querySelectorAll('img')].map(img=>new Promise((resolve,reject)=>{
  const finish=()=>{clearTimeout(timer);img.removeEventListener('load',loaded);img.removeEventListener('error',failed)}
  const loaded=()=>{finish();img.naturalWidth>0?resolve():reject(Error('Report logo could not load / تعذر تحميل شعار التقرير'))}
  const failed=()=>{finish();reject(Error('Report logo could not load / تعذر تحميل شعار التقرير'))}
  const timer=setTimeout(failed,timeout)
  if(img.complete){loaded();return}
  img.addEventListener('load',loaded,{once:true});img.addEventListener('error',failed,{once:true})
 })))
}
