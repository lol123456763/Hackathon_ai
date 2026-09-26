import { useEffect, useRef } from 'react';
import { Phone, MessageSquare, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Button, Card } from './ui';

// Shown before anything else whenever crisis language is detected.
export default function CrisisPanel({ onContinue }) {
  const { t } = useI18n();
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);

  const lines = [
    { label: t('crisis.emergency'), number: '911', tel: '911' },
    { label: t('crisis.lifeline'), hint: t('crisis.lifelineHint'), number: '988', tel: '988', sms: '988' },
    { label: t('crisis.dv'), hint: t('crisis.dvHint'), number: '1-800-799-7233', tel: '18007997233', sms: '88788', smsBody: 'START' },
    { label: t('crisis.local'), number: '2-1-1', tel: '211' },
  ];

  return (
    <Card role="alertdialog" aria-labelledby="crisis-title" aria-describedby="crisis-body" className="border-danger/40 p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-1 h-7 w-7 shrink-0 text-danger" aria-hidden="true" />
        <div>
          <h2 id="crisis-title" ref={ref} tabIndex={-1} className="text-xl font-bold focus:outline-none sm:text-2xl">
            {t('crisis.title')}
          </h2>
          <p id="crisis-body" className="mt-2 text-muted-foreground">{t('crisis.body')}</p>
        </div>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {lines.map((l) => (
          <li key={l.number} className="rounded-xl border bg-background p-4">
            <p className="font-semibold">{l.label}</p>
            {l.hint && <p className="text-sm text-muted-foreground">{l.hint}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button as="a" href={`tel:${l.tel}`} variant="danger" size="sm">
                <Phone className="h-4 w-4" aria-hidden="true" /> {t('crisis.call', { number: l.number })}
              </Button>
              {l.sms && (
                <Button as="a" href={`sms:${l.sms}${l.smsBody ? `?&body=${l.smsBody}` : ''}`} variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4" aria-hidden="true" /> {t('crisis.text', { number: l.sms })}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {onContinue && (
        <Button variant="outline" className="mt-5 w-full sm:w-auto" onClick={onContinue}>
          {t('crisis.continue')}
        </Button>
      )}
    </Card>
  );
}
