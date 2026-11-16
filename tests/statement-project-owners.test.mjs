import test from 'node:test'
import assert from 'node:assert/strict'
import {statementOwners,projectsForOwner,statementReady} from '../src/lib/statementProjects.js'
const projects=[{id:'real',owner:'Real owner',can_finance:true,policy:null},{id:'test',owner:'Training owner',can_finance:true,policy:{status:'active'}},{id:'draft',owner:'Real owner',can_finance:false,policy:{status:'draft'}}]
test('Owners remain visible before their project approval chains are activated',()=>{assert.deepEqual(statementOwners(projects),['Real owner','Training owner']);assert.deepEqual(projectsForOwner(projects,'Real owner').map(p=>p.id),['real','draft']);assert.equal(statementReady(projects[0]),false);assert.equal(statementReady(projects[1]),true)})
test('Owner selection never invents projects or grants financial authority',()=>{assert.deepEqual(projectsForOwner(projects,'Unknown'),[]);assert.deepEqual(projectsForOwner(projects,''),[]);assert.equal(statementReady({...projects[2],policy:{status:'active'}}),false);assert.equal(statementReady(undefined),false)})
