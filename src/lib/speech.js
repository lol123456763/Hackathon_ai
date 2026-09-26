// Browser speech helpers: voice input (SpeechRecognition) and read-aloud (speechSynthesis).
import { useCallback, useEffect, useRef, useState } from 'react';

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export function useVoiceInput({ lang, onText }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const supported = !!Recognition;

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = lang === 'es' ? 'es-US' : 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      onTextRef.current((finalText + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [lang]);

  useEffect(() => () => recRef.current?.abort?.(), []);
  return { supported, listening, start, stop };
}

export function useReadAloud(lang) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text) => {
      if (!supported || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'es' ? 'es-US' : 'en-US';
      u.rate = 0.95;
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith(lang === 'es' ? 'es' : 'en'));
      if (voice) u.voice = voice;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [lang, supported],
  );

  useEffect(() => () => supported && window.speechSynthesis.cancel(), [supported]);
  return { supported, speaking, speak, stop };
}
