import {hasFacilitiesPermission} from './facilitiesPermissions.js'

export function hasScopedCyclePermission(rows,permission,scope={}){
 return hasFacilitiesPermission((rows||[]).filter(p=>
  (!scope.organization_id||p.organization_id===scope.organization_id)&&
  (!scope.project_id||p.project_id===scope.project_id)&&
  (!p.site_id||p.site_id===scope.site_id)&&
  (!p.discipline_code||p.discipline_code===scope.discipline_code)
 ),permission,scope.organization_id||null)
}
