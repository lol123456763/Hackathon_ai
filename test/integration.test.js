import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {localExtract, matchResources, stateFromZip} from '../lib.js';
import {seedResources} from '../data.js';

test('BenefitBridge example works in English and Spanish and saves progress', async () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'benefitbridge-test-'));
  process.env.NODE_ENV='test';
  process.env.DATA_DIR=temp;
  process.env.ADMIN_TOKEN='integration-test-secret-token-12345';
  const {server,db}=await import('../server.js');
  await new Promise(resolve=>server.listen(0,resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async (route,method='GET',body,admin=false) => {
    const response=await fetch(base+route,{method,headers:{'content-type':'application/json',...(admin?{authorization:`Bearer ${process.env.ADMIN_TOKEN}`}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json()};
  };
  try {
    assert.equal(stateFromZip('78741'),'TX');
    assert.equal(stateFromZip('00000'),null);
    const demo="I'm a single mom with 2 kids, ages 3 and 8. I just lost my job last week. We live in 78741 and I'm behind on the electric bill and running low on groceries.";
    const extracted=(await request('/api/extract','POST',{text:demo})).data;
    assert.equal(extracted.zip,'78741');
    assert.equal(extracted.household_size,3);
    assert.equal(extracted.children_count,2);
    assert.equal(extracted.child_under_5,true);
    assert.equal(extracted.crisis_flag,false);
    assert.equal(localExtract('Me quiero morir y necesito ayuda').crisis_flag,true);
    const expected=matchResources(seedResources,{zip:'78741',needs:['food','utilities','school_childcare','healthcare','employment'],children_count:2,child_under_5:true});
    assert.equal(expected.matches[0].id,'austin_energy');
    assert.ok(expected.matches.some(x=>x.id==='ctfb'));
    assert.ok(!expected.matches.some(x=>x.id==='211'));
    for (const language of ['en','es']) {
      const profile={zip:'78741',household_size:3,children_count:2,child_under_5:true,situations:['single_parent','lost_job'],needs:['food','utilities','school_childcare','healthcare','employment'],urgency:'today',language};
      const created=await request('/api/plans','POST',profile);
      assert.equal(created.status,201);
      const plan=created.data;
      assert.equal(plan.profile.language,language);
      assert.ok(plan.id.length>=32);
      assert.ok(plan.matched_resources.length>=10);
      assert.deepEqual(plan.action_plan.today.map(x=>x.resource_id).slice(0,2),['austin_energy','ctfb']);
      assert.ok(plan.action_plan.this_week.length>0);
      assert.ok(plan.action_plan.bring.length>0);
      assert.ok(plan.selected_ids.length>=6);
      assert.match(plan.action_plan.today[0].action,language==='es'?/Visite/:/Visit/);
      const checked=await request(`/api/plans/${plan.id}`,'PATCH',{checklist_state:{'Proof of income':true}});
      assert.equal(checked.status,200);
      const reloaded=await request(`/api/plans/${plan.id}`);
      assert.equal(reloaded.data.checklist_state['Proof of income'],true);
      const translated=await request(`/api/plans/${plan.id}?lang=${language==='es'?'en':'es'}`);
      assert.match(translated.data.action_plan.today[0].action,language==='es'?/Visit/:/Visite/);
      const feedback=await request('/api/feedback','POST',{plan_id:plan.id,resource_id:'ctfb',rating:'not_helpful'});
      assert.equal(feedback.status,201);
    }
    const invalid=await request('/api/plans','POST',{zip:'12',needs:['food']});
    assert.equal(invalid.status,400);
    const unknown=await request('/api/plans','POST',{zip:'00000',needs:['food'],language:'en'});
    assert.equal(unknown.data.out_of_coverage,true);
    assert.ok(unknown.data.matched_resources.every(r=>r.coverage_type==='national'));
    assert.equal((await request('/api/admin/resources')).status,401);
    const admin=await request('/api/admin/analytics','GET',undefined,true);
    assert.equal(admin.status,200);
    assert.ok(admin.data.not_helpful.some(x=>x.resource_id==='ctfb'&&x.count===2));
  } finally {
    await new Promise(resolve=>server.close(resolve));db.close();
    if (temp.startsWith(os.tmpdir()+path.sep)) fs.rmSync(temp,{recursive:true,force:true});
  }
});
