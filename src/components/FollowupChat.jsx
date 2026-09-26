import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api } from '@/api/backend';
import { LIMITS } from '@shared/constants.js';
import { Alert, Button, Input, cn } from './ui';
import CrisisPanel from './CrisisPanel';

export default function FollowupChat({ token, resources }) {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages, busy]);

  async function ask(question) {
    const text = question.trim().slice(0, LIMITS.followupQuestion);
    if (!text || busy) return;
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: 'user', text }]);
    setQ('');
    setBusy(true);
    try {
      const res = await api.askFollowup(token, text, history, lang);
      if (res.crisis) setCrisis(true);
      setMessages((m) => [...m, { role: 'assistant', text: res.answer || t('ask.unavailable'), ids: res.resource_ids || [], failed: !res.answer }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: t('ask.unavailable'), ids: [], failed: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t('ask.intro')}</p>
      {crisis && <CrisisPanel onContinue={() => setCrisis(false)} />}

      <div className="flex flex-wrap gap-2">
        {t('ask.suggestions').map((s) => (
          <button key={s} type="button" onClick={() => ask(s)} disabled={busy} className="min-h-[40px] rounded-full border bg-card px-3 text-sm hover:bg-muted disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      <ol className="space-y-3" aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={cn('flex gap-2', m.role === 'user' && 'flex-row-reverse')}>
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', m.role === 'user' ? 'bg-accent-soft' : 'bg-primary text-primary-foreground')}>
              {m.role === 'user' ? <User className="h-4 w-4" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
              <span className="sr-only">{m.role === 'user' ? t('ask.you') : t('ask.bot')}</span>
            </span>
            <div className={cn('max-w-[85%] rounded-2xl px-4 py-3', m.role === 'user' ? 'bg-accent-soft' : 'border bg-card', m.failed && 'border-accent/50')}>
              <p className="whitespace-pre-line">{m.text}</p>
              {m.ids?.length > 0 && (
                <div className="mt-2 border-t pt-2 text-sm">
                  <p className="font-semibold">{t('ask.mentioned')}:</p>
                  <ul className="mt-1 space-y-1">
                    {m.ids.map((id) =>
                      resources[id] ? (
                        <li key={id}>
                          <button type="button" className="text-left text-primary underline underline-offset-2" onClick={() => window.dispatchEvent(new CustomEvent('bb:show-resource', { detail: id }))}>
                            {resources[id].name}
                          </button>
                          {resources[id].phone && <span className="text-muted-foreground"> · {resources[id].phone}</span>}
                        </li>
                      ) : null,
                    )}
                  </ul>
                </div>
              )}
            </div>
          </li>
        ))}
        {busy && (
          <li className="flex gap-2" role="status">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="rounded-2xl border bg-card px-4 py-3 text-muted-foreground">{t('ask.thinking')}</span>
          </li>
        )}
      </ol>
      <div ref={endRef} />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <label htmlFor="followup" className="sr-only">
          {t('ask.placeholder')}
        </label>
        <Input id="followup" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ask.placeholder')} maxLength={LIMITS.followupQuestion} autoComplete="off" />
        <Button type="submit" disabled={!q.trim()} loading={busy} aria-label={t('ask.send')}>
          <Send className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('ask.send')}</span>
        </Button>
      </form>
      <Alert variant="info">{t('ask.disclaimer')}</Alert>
    </div>
  );
}
