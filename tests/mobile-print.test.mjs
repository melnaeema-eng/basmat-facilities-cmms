import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const exporter=await readFile(new URL('../src/lib/reportExport.js',import.meta.url),'utf8')
const management=await readFile(new URL('../src/pages/ManagementReports.jsx',import.meta.url),'utf8')
const documents=await readFile(new URL('../src/pages/Documents.jsx',import.meta.url),'utf8')
const owner=await readFile(new URL('../src/pages/OwnerReports.jsx',import.meta.url),'utf8')

test('mobile PDF export opens its print window during the original tap',()=>{
 assert.match(management,/const printWindow=kind==='pdf'\?openPrintWindow\(lang\):null/)
 assert.ok(management.indexOf("openPrintWindow(lang)")<management.indexOf('await reportExport'))
 assert.match(management,/printReport\([^\n]+printWindow\)/)
})

test('print documents include a mobile viewport and responsive preview',()=>{
 assert.match(exporter,/name="viewport"/)
 assert.match(exporter,/@media screen and \(max-width:700px\)/)
 assert.match(exporter,/Allow pop-ups for this site/)
 assert.match(documents,/Allow pop-ups for this site/)
})

test('owner report invokes same-page printing without a delayed timer',()=>{
 assert.match(owner,/body\.classList\.add\('owner-report-print-mode'\)[\s\S]*window\.print\(\)/)
 assert.doesNotMatch(owner,/setTimeout\(\(\)=>window\.print/)
})
