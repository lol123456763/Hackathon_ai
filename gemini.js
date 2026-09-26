export async function askGemini(system, payload, {key, model='gemini-3.5-flash-lite', fetchImpl=fetch} = {}) {
  if (!key) throw new Error('Gemini unavailable');
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method:'POST',
    headers:{'x-goog-api-key':key,'content-type':'application/json'},
    body:JSON.stringify({
      systemInstruction:{parts:[{text:system}]},
      contents:[{role:'user',parts:[{text:JSON.stringify(payload)}]}],
      generationConfig:{responseMimeType:'application/json',maxOutputTokens:1800}
    }),
    signal:AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const data=await response.json();
  const output=data.candidates?.[0]?.content?.parts?.filter(part=>typeof part.text==='string').map(part=>part.text).join('') || '';
  if (!output) throw new Error('Gemini returned no text');
  return JSON.parse(output.replace(/^```(?:json)?\s*|\s*```$/g,''));
}
