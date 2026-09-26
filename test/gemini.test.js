import test from 'node:test';
import assert from 'node:assert/strict';
import {askGemini} from '../gemini.js';

test('Gemini receives server-side credentials and returns JSON', async () => {
  let called=false;
  const result=await askGemini('Return JSON',{text:'hello'}, {
    key:'test-only-key',model:'gemini-3.5-flash-lite',
    fetchImpl:async (url,options) => {
      called=true;
      assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
      assert.equal(options.headers['x-goog-api-key'],'test-only-key');
      assert.ok(!url.includes('test-only-key'));
      const body=JSON.parse(options.body);
      assert.equal(body.systemInstruction.parts[0].text,'Return JSON');
      assert.equal(body.contents[0].parts[0].text,'{"text":"hello"}');
      assert.equal(body.generationConfig.responseMimeType,'application/json');
      return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"answer":"ok"}'}]}}]})};
    }
  });
  assert.equal(called,true);
  assert.deepEqual(result,{answer:'ok'});
});

test('Gemini rejects missing output so local guidance can take over', async () => {
  await assert.rejects(askGemini('Return JSON',{}, {
    key:'test-only-key',fetchImpl:async()=>({ok:true,json:async()=>({candidates:[]})})
  }),/no text/);
});
