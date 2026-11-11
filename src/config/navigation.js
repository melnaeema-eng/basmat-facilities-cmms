import {modules,permitted} from './modules.js'

// One primary entry per task. Specialized pages remain reachable in their context.
export const navigationGroups=[
 {en:'Work',ar:'التشغيل',paths:['/','/facility-asset-cockpit','/corrective','/ppm','/approvals','/documents','/notifications']},
 {en:'Setup',ar:'الإعداد',paths:['/project-setup','/asset-library','/contracts','/users','/roles-permissions']},
 {en:'Support',ar:'المساندة',paths:['/inventory','/procurement','/reports']}
]
export const toolFamilies=[
 {root:'/facility-asset-cockpit',tools:['/assets','/asset-passport','/asset-lifecycle','/asset-categories','/qr-scan'],ar:'تسجيل الأصل وموقعه وجوازه وسجل حياته.',en:'Asset registration, location, passport and lifecycle.'},
 {root:'/asset-library',tools:['/library-admin','/library-deployment'],ar:'المكتبة مرجع الأنواع والموديلات والإجراءات؛ الأصول المسجلة تُدار في الأصول والصيانة.',en:'The catalog contains types, models and procedure references. Registered assets are managed in Assets & Maintenance.'},
 {root:'/corrective',tools:['/work-orders','/technician-execution','/field-mobile','/workforce'],ar:'البلاغات والإسناد والتنفيذ، ثم الإغلاق والشهادة من الملف المتكامل.',en:'Requests, assignment and execution, then certification and closeout in the integrated dossier.'},
 {root:'/ppm',tools:['/planning'],ar:'إجراءات الوقائية والخطط والزيارات المجدولة.',en:'Preventive procedures, plans and scheduled visits.'},
 {root:'/approvals',tools:['/compliance','/permits','/hse'],ar:'القرارات المعلقة وأدوات الامتثال والتصاريح والسلامة.',en:'Pending decisions, compliance, permits and safety.'},
 {root:'/documents',tools:['/document-control'],ar:'التقارير والشهادات الصادرة؛ ضبط المستندات للمرفقات والمراسلات وإصداراتها.',en:'Issued reports and certificates; Document Control manages attachments, correspondence and revisions.'},
 {root:'/project-setup',tools:['/organizations','/owners','/sites','/locations','/enterprise-structure','/facility-reference-library'],ar:'إعداد الجهات والعقد والمشروع، ثم المنشآت والمباني والطوابق والغرف والفريق.',en:'Set up parties, contract and project, followed by sites, buildings, floors, rooms and team.'},
 {root:'/contracts',tools:['/contract-renewal','/statements','/maintenance-costing'],ar:'بيانات العقد وتجديده والمستخلصات والتكاليف.',en:'Contract records, renewals, statements and costs.'},
 {root:'/users',tools:['/enterprise-access','/access-review'],ar:'المستخدمون وأدوارهم؛ نطاق المشروع والموقع يحدد أين تُستخدم الصلاحية.',en:'Users and their roles; project and site scope determines where permission applies.'},
 {root:'/roles-permissions',tools:['/governance','/audit','/security-readiness','/release-readiness'],ar:'تعريف الأدوار والصلاحيات والحوكمة وسجل التدقيق.',en:'Role definitions, permissions, governance and audit history.'},
 {root:'/inventory',tools:['/advanced-stock'],ar:'الأصناف والمخازن والأرصدة والحركات؛ طلبات القطع والحجز والصرف والمرتجع في أدوات قطع الغيار.',en:'Items, stores, balances and movements; spare-parts tools handle requests, reservations, issues and returns.'},
 {root:'/procurement',tools:['/supplier-performance'],ar:'طلبات وأوامر الشراء والاستلام وتقييم الموردين.',en:'Requisitions, purchase orders, receipt and supplier evaluation.'},
 {root:'/reports',tools:['/kpi','/executive','/backlog','/reliability','/utilities'],ar:'تقارير المالك والتشغيل، مع تحليلات الأداء والاعتمادية والاستهلاك.',en:'Owner and operational reporting, with performance, reliability and consumption analysis.'}
]
export const standaloneTools=['/soft-fm','/owner-portal']
export const primaryPaths=new Set(navigationGroups.flatMap(g=>g.paths))
const familyPaths=new Set(toolFamilies.flatMap(f=>[f.root,...f.tools]))
const aliases=[
 ['/assets/:id','/facility-asset-cockpit'],['/asset-passport/:id','/facility-asset-cockpit'],
 ['/corrective/:kind/:id','/corrective'],['/maintenance-cycle/:id','/corrective'],
 ['/ppm/:kind/:id','/ppm'],['/inventory/request/:id','/inventory'],
 ['/advanced-stock/:id','/inventory'],['/procurement/:kind/:id','/procurement'],['/statements/:id','/contracts']
]
function matches(pattern,path){
 const parts=pattern.split('/'),actual=path.replace(/\/$/,'').split('/')
 return parts.length===actual.length&&parts.every((part,i)=>part.startsWith(':')?!!actual[i]:part===actual[i])
}
export function familyForPath(path){
 const direct=toolFamilies.find(f=>f.root===path||f.tools.includes(path))
 if(direct)return direct
 const root=aliases.find(([pattern])=>matches(pattern,path))?.[1]
 return toolFamilies.find(f=>f.root===root)||null
}
export const isNavigableModule=module=>primaryPaths.has(module.path)||familyPaths.has(module.path)||standaloneTools.includes(module.path)
export function toolsForPath(path,can){
 const family=familyForPath(path)
 return family?[family.root,...family.tools].map(path=>modules.find(m=>m.path===path)).filter(m=>m&&permitted(m,can)):[]
}
export function secondaryNavigation(can){
 const byPath=new Map(modules.map(m=>[m.path,m])),result=[]
 for(const path of standaloneTools){const m=byPath.get(path);if(m&&permitted(m,can))result.push(m)}
 // A user with only a specialist permission still needs an entry to that tool.
 for(const family of toolFamilies){
  if(permitted(byPath.get(family.root),can))continue
  const fallback=family.tools.map(p=>byPath.get(p)).find(m=>m&&permitted(m,can))
  if(fallback)result.push(fallback)
 }
 return result
}
