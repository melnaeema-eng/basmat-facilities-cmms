// UI aliases for the deployed Facilities ACL. Database RPCs still enforce access.
const aliases={
 'corrective.view':['facilities.work_orders.view'],
 'corrective.request':['facilities.work_orders.manage'],
 'corrective.manage':['facilities.work_orders.manage'],
 'corrective.execute':['facilities.work_orders.execute'],
 'corrective.approve':['facilities.work_orders.review'],
 'ppm.view':['facilities.ppm.view'],
 'ppm.manage':['facilities.ppm.manage'],
 'ppm.execute':['facilities.ppm.execute'],
 'ppm.approve':['facilities.ppm.review'],
 'assets.view':['facilities.assets.view'],
 'assets.manage':['facilities.assets.manage'],
 'clients.view':['projects.view'],
 'contracts.view':['projects.view'],
 'contracts.manage':['projects.manage'],
 'enterprise-structure.view':['projects.view'],
 'enterprise-structure.manage':['projects.manage'],
 'organizations.view':['companies.view'],
 'inventory.view':['facilities.inventory.view'],
 'inventory.request':['facilities.inventory.request','facilities.inventory.manage'],
 'inventory.manage':['facilities.inventory.manage'],
 'inventory.approve':['facilities.inventory.approve'],
 'documents.generate':['reports.export'],
 'costing.view':['costing.manage','finance.view','finance.manage','facilities.statements.view','facilities.statements.manage'],
 'costing.manage':['finance.manage','facilities.statements.manage'],
 'approvals.request':['facilities.work_orders.manage']
}
export function hasFacilitiesPermission(permissions,key,organizationId=null){
 const allowed=[key,...(aliases[key]||[])]
 return (permissions||[]).some(p=>allowed.includes(p.permission_key)&&(!organizationId||p.organization_id===organizationId))
}
