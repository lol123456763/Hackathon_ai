// Optional Gemini provider (ported from the original BenefitBridge server by Deepam M.).
// Used by the Base44 function when the GEMINI_API_KEY secret is set; otherwise Base44's built-in
// InvokeLLM is used. The key stays on the server and is never sent to the browser.

export async function askGemini({ prompt, response_json_schema }, { key, model = 'gemini-3.5-flash-lite', fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  if (!key) throw new Error('Gemini unavailable');
  const schemaNote = response_json_schema ? `\n\nReturn ONLY JSON matching this JSON schema:\n${JSON.stringify(response_json_schema)}` : '';
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${prompt}${schemaNote}` }] }],
      generationConfig: { responseMimeType: response_json_schema ? 'application/json' : 'text/plain', maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const data = await response.json();
  const output = data.candidates?.[0]?.content?.parts?.filter((p) => typeof p.text === 'string').map((p) => p.text).join('') || '';
  if (!output) throw new Error('Gemini returned no text');
  if (!response_json_schema) return output;
  return JSON.parse(output.replace(/^```(?:json)?\s*|\s*```$/g, ''));
}
