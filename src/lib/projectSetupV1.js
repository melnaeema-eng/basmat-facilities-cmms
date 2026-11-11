import {createProject} from './enterpriseStructure'
export async function createSetupProject(values){
 const data=await createProject(values)
 const row=Array.isArray(data)?data[0]:data
 return typeof row==='string'?row:(row?.id||row?.project_id)
}
