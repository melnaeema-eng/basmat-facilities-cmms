import {modules,permitted} from './modules.js'

// One entrance per user goal. Detailed modules remain inside their centre.
export const navigationGroups=[
 {en:'Daily work',ar:'العمل اليومي',paths:['/','/corrective','/facility-asset-cockpit','/inventory','/reports']},
 {en:'Company administration',ar:'إدارة الشركة',paths:['/project-setup','/users','/maintenance-companies']}
]
export const toolFamilies=[
 {root:'/corrective',tools:['/ppm','/planning','/technician-execution','/field-mobile','/workforce','/approvals','/work-orders','/documents','/document-control','/notifications','/compliance','/permits','/hse'],ar:'دورة الصيانة الكاملة: البلاغات والوقائية والتنفيذ والاعتماد والشهادة والمستخلص.',en:'The complete maintenance cycle: requests, PPM, execution, approvals, certificates and statements.'},
 {root:'/facility-asset-cockpit',tools:['/assets','/asset-passport','/asset-lifecycle','/asset-categories','/qr-scan','/sites','/locations','/asset-library','/library-admin','/library-deployment'],ar:'الأصول ومواقعها وجوازاتها ومكتبة إجراءات الصيانة.',en:'Assets, locations, passports and the maintenance procedure library.'},
 {root:'/inventory',tools:['/advanced-stock','/procurement','/suppliers','/supplier-performance'],ar:'المخزون وطلبات قطع الغيار والمشتريات والموردون.',en:'Stock, spare-parts requests, procurement and suppliers.'},
 {root:'/reports',tools:['/kpi','/executive','/backlog','/reliability','/utilities','/contracts','/contract-renewal','/statements','/maintenance-costing'],ar:'التقارير التشغيلية وتقارير المالك والعقود والمستخلصات.',en:'Operational and owner reports, contracts and statements.'},
 {root:'/project-setup',tools:['/owners','/enterprise-structure'],ar:'إعداد الملاك والمشاريع والعقود والمواقع والهيكل المكاني.',en:'Set up owners, projects, contracts, sites and location hierarchy.'},
 {root:'/users',tools:['/roles-permissions','/enterprise-access','/access-review','/governance','/audit','/security-readiness','/release-readiness'],ar:'المستخدمون وأدوارهم وصلاحياتهم ونطاق وصولهم للمشاريع والمواقع.',en:'Users, roles, permissions and their project and site access.'},
 {root:'/maintenance-companies',tools:['/organizations','/facility-reference-library'],ar:'إنشاء مساحة شركة مستقلة أو فتحها وتعديل هويتها.',en:'Create, open or update an isolated company workspace.'}
]
export const standaloneTools=['/owner-portal','/soft-fm']
export const primaryPaths=new Set(navigationGroups.flatMap(g=>g.paths))
const familyPaths=new Set(toolFamilies.flatMap(f=>[f.root,...f.tools]))
const aliases=[
 ['/assets/:id','/facility-asset-cockpit'],['/asset-passport/:id','/facility-asset-cockpit'],
 ['/corrective/:kind/:id','/corrective'],['/maintenance-cycle/:id','/corrective'],
 ['/ppm/:kind/:id','/corrective'],['/inventory/request/:id','/inventory'],
 ['/advanced-stock/:id','/inventory'],['/procurement/:kind/:id','/inventory'],['/statements/:id','/reports']
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
 for(const family of toolFamilies){
  if(permitted(byPath.get(family.root),can))continue
  const fallback=family.tools.map(p=>byPath.get(p)).find(m=>m&&permitted(m,can))
  if(fallback)result.push(fallback)
 }
 return result
}
