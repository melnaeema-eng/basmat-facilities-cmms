import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const css=await readFile(new URL('../src/components/AppShellActions.css',import.meta.url),'utf8')
const shell=await readFile(new URL('../src/components/AppShell.jsx',import.meta.url),'utf8')

test('phone layout contains the navigation drawer and prevents horizontal overflow',()=>{
 assert.match(css,/@media\(max-width:900px\)/)
 assert.match(css,/max-width:calc\(100vw - 44px\)/)
 assert.match(css,/overflow-x:hidden/)
 assert.match(css,/\.bafm-shell \.bafm-sidebar\.is-open\{display:flex!important\}/)
 assert.match(shell,/className="bafm-drawer-close"/)
 assert.match(shell,/document\.body\.style\.overflow='hidden'/)
})

test('phone dashboard uses one readable column',()=>{
 assert.match(css,/\.workspace-dashboard-grid,\.workspace-metrics,\.workspace-quick-grid\{grid-template-columns:1fr\}/)
 assert.match(css,/\.workspace-pipeline\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/)
})
