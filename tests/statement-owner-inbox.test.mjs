import test from 'node:test'
import assert from 'node:assert/strict'
import {statementInboxCapabilities} from '../src/lib/statementProjects.js'
test('Owner sees activation instead of the company authoring form',()=>{const p={id:'project',can_finance:false,can_activate:true,policy:{status:'draft'}};assert.deepEqual(statementInboxCapabilities([p]),{canCreate:false,activationProjects:[p]})})
test('Company preparer sees authoring without receiving owner activation',()=>{assert.deepEqual(statementInboxCapabilities([{can_finance:true,can_activate:false,policy:{status:'draft'}}]),{canCreate:true,activationProjects:[]})})
test('Activated chains and registry-only projects do not offer activation',()=>{assert.deepEqual(statementInboxCapabilities([{can_finance:false,can_activate:true,policy:{status:'active'}},{setup_required:true}]),{canCreate:false,activationProjects:[]})})
