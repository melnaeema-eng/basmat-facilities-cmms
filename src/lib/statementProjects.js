// Only use projects returned by the scoped cycle API. Readiness must not hide their owners.
export function statementOwners(projects){return [...new Set(projects.map(p=>p.owner).filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
export function projectsForOwner(projects,owner){return owner?projects.filter(p=>p.owner===owner):[]}
export function statementReady(project){return !!(project?.can_finance&&project.policy?.status==='active')}
