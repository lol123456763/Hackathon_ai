import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Lock, Package, ShoppingBag, MapPin, Heart, Phone } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { hhmmLabel, fmtHours } from '@/lib/format';
import { formatTime } from '@shared/time.js';
import { AiTag, CodeInput, Confetti, Sheet } from '@/components/bits';
import LoopRing from '@/components/LoopRing';
import { Loopy } from '@/components/decor';
import { Alert, Button, Card, cn } from '@/components/ui';
import { MODE_ICON } from './Missions';
import RouteString from '@/components/RouteString';

const LiveMap = lazy(() => import('@/components/LiveMap'));

/** The handoff summary shown once both codes check out. */
function HandoffReceipt({ m }) {
  const { t, lang } = useI18n();
  const { live } = useApp();
  const families = (m.requests || []).length;
  const rows = [
    [t('vol.receipt.from'), m.giver?.name],
    [t('vol.receipt.to'), m.hub?.name],
    [t('vol.receipt.food'), `${m.lbs_delivered} lbs`],
    [t('vol.receipt.meals'), `~${m.meals}`],
    [t('vol.receipt.families'), families],
    [t('vol.receipt.hours'), `+${fmtHours(m.credited_hours)} ${t('vol.receipt.each')}`],
  ];
  return (
    <div className="relative mx-auto mt-4 max-w-[300px] overflow-hidden pt-1" aria-hidden="true">
            <div className="cut-2 -mt-1 animate-fade-up border-2 border-dashed border-[#a5bdaa] bg-card px-5 py-4 text-left text-sm leading-relaxed">
        <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-teal">Loop · {t('vol.receipt.title')}</p>
        <p className="text-center text-[11px] opacity-70">{live ? formatTime(live.clock.now, lang) : ''} · #{m.key.slice(-4).toUpperCase()}</p>
        <p className="my-2 border-t-2 border-dashed border-ink/40" />
        {rows.map(([k, v]) => (
          <p key={k} className="flex justify-between gap-3">
            <span className="shrink-0 opacity-70">{k}</span>
            <span className="truncate text-right font-bold">{v}</span>
          </p>
        ))}
        <p className="my-2 border-t-2 border-dashed border-ink/40" />
        <p className="text-center">{(m.volunteer_names || []).join(' + ')}</p>
        <p className="text-center font-bold">{t('vol.receipt.verified')} ✓✓</p>
      </div>
    </div>
  );
}

export function Celebration({ m }) {
  const { t, lang } = useI18n();
  const families = (m.requests || []).length;
  return (
    <Card shape={1} className="overflow-hidden p-5 text-center shadow-offset-lg">
      <Confetti />
      <div className="flex items-end justify-center gap-2">
        <LoopRing size={80} closed animate />
        <Loopy mood="cheer" size={84} />
      </div>
      <h2 className="mt-3 text-2xl font-extrabold">{t('vol.celebrate')}</h2>
      <p className="sr-only" aria-live="polite">
        {t('vol.celebrateLine', { lbs: m.lbs_delivered, meals: m.meals, families, hours: fmtHours(m.credited_hours), names: (m.volunteer_names || []).join(lang === 'es' ? ' y ' : ' & ') })}
      </p>
      <HandoffReceipt m={m} />
      {m.thanks?.length > 0 && (
        <div className="mt-4 space-y-2 text-left">
          <p className="flex items-center gap-1 text-sm font-bold">
            <Heart className="h-4 w-4 text-accent" aria-hidden="true" /> {t('vol.thanksTitle')}
          </p>
          {m.thanks.map((n, i) => (
            <blockquote key={i} className={cn('border-2 border-border p-3', i % 2 ? 'cut-3 rotate-1 bg-tile-2' : 'cut-2 -rotate-1 bg-tile-4')}>
              {n.fixed ? (
                <p className="font-semibold">{t('vol.fixedThanks')}</p>
              ) : (
                <>
                  <p className="font-display text-lg italic leading-snug">“{n.text}”</p>
                  {n.from_language && n.from_language !== lang && <p className="mt-1 text-xs text-muted-foreground">{n.from_language === 'es' ? t('vol.translated') : t('vol.translatedEn')}</p>}
                </>
              )}
            </blockquote>
          ))}
        </div>
      )}
      <Button as={Link} to="/missions" variant="outline" className="mt-4">
        {t('vol.backToMissions')}
      </Button>
    </Card>
  );
}

export default function MissionDetail() {
  const { key } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { live, act, identity, hideHelpers } = useApp();
  const [buddy, setBuddy] = useState(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [weightStep, setWeightStep] = useState(false);
  const [lbs, setLbs] = useState(null);
  const [adjust, setAdjust] = useState(false);
  const [dropCode, setDropCode] = useState('');
  const [dropReady, setDropReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unsafeOpen, setUnsafeOpen] = useState(false);
  const [unsafeDone, setUnsafeDone] = useState(false);

  const m = live?.missions.find((x) => x.key === key);
  if (!live) return <div className="skeleton mt-4 h-64" />;
  if (unsafeDone) {
    return (
      <div className="space-y-4 pt-4">
        <Alert variant="danger" title={t('vol.unsafeDone')}>
          <Button as="a" href="tel:911" variant="danger" size="sm" className="mt-2">
            <Phone className="h-4 w-4" aria-hidden="true" /> {t('crisis.call', { number: '911' })}
          </Button>
        </Alert>
        <Button as={Link} to="/missions" variant="outline">
          {t('vol.backToMissions')}
        </Button>
      </div>
    );
  }
  if (!m) {
    return (
      <div className="pt-4">
        <Button variant="ghost" onClick={() => navigate('/missions')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('vol.backToMissions')}
        </Button>
      </div>
    );
  }

  const title = lang === 'es' ? m.title_es : m.title_en;
  const brief = lang === 'es' ? m.brief_es : m.brief_en;
  const steps = (lang === 'es' ? m.steps_es : m.steps_en) || [];
  const safety = (lang === 'es' ? m.safety_checklist_es : m.safety_checklist_en) || [];
  const Icon = MODE_ICON[m.mode];
  const active = m.mine && ['claimed', 'picked_up'].includes(m.status);
  const plannedLbs = m.lbs_planned;

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const claim = () =>
    run(async () => {
      await act('claimMission', { mission_key: m.key, volunteer_key: identity, buddy_key: buddy || undefined }).catch(() => {});
    });

  const pickup = () =>
    run(async () => {
      try {
        await act('missionPickup', { mission_key: m.key, volunteer_key: identity, code, confirmed_lbs: lbs ?? plannedLbs }, { silent: true });
        setCodeError(null);
        setWeightStep(false);
      } catch (e) {
        setWeightStep(false);
        setCodeError(e?.code === 'wrong_code' ? t('vol.wrongCode') : e?.code === 'outside_window' ? t('vol.outsideWindow') : t('errors.generic'));
      }
    });

  const dropoff = () =>
    run(async () => {
      try {
        await act('missionDropoff', { mission_key: m.key, volunteer_key: identity, code: dropCode }, { silent: true });
        setCodeError(null);
      } catch (e) {
        setDropReady(false);
        setCodeError(e?.code === 'wrong_code' ? t('vol.wrongCode') : e?.code === 'outside_window' ? t('vol.outsideWindow') : t('errors.generic'));
      }
    });

  if (m.mine && m.status === 'verified') return <div className="pt-2"><Celebration m={m} /></div>;

  return (
    <div className="space-y-4 pt-2">
      <Button variant="ghost" size="sm" onClick={() => navigate('/missions')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('vol.backToMissions')}
      </Button>
      <div>
        <h1 className="text-xl font-extrabold leading-snug">{title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {Icon && <Icon className="h-4 w-4" aria-hidden="true" />} {m.distance_mi} {t('common.mi')} {t(`vol.mode.${m.mode}`)} · {t('vol.about', { min: m.est_minutes })} · {hhmmLabel(m.window_start, lang)}–{hhmmLabel(m.window_end, lang)}
        </p>
        {(lang === 'es' ? m.impact_es : m.impact_en) && <p className="mt-1 font-semibold text-primary">{lang === 'es' ? m.impact_es : m.impact_en}</p>}
      </div>
      {m.giver && m.hub && <RouteString status={m.status} from={m.giver.name} to={m.hub.name} />}

      {active && (
        <Button variant="danger" className="w-full" onClick={() => setUnsafeOpen(true)}>
          <ShieldAlert className="h-5 w-5" aria-hidden="true" /> {t('vol.unsafe')}
        </Button>
      )}

      {/* Run steps */}
      {m.mine && m.status === 'claimed' && (
        <Card className="border-2 border-accent p-4">
          <h2 className="font-extrabold">{t('vol.step1', { place: m.giver?.name })}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('vol.step1Body')}</p>
          <div className="mt-3">
            <CodeInput
              label={t('vol.pickupCode')}
              value={code}
              onChange={(v) => {
                setCode(v);
                setCodeError(null);
                if (v.length === 4) setWeightStep(true);
              }}
              demoCode={m.demo_codes?.pickup}
              error={codeError}
            />
          </div>
          {weightStep && code.length === 4 && (
            <div className="mt-3 rounded-xl bg-muted p-3">
              <p className="font-semibold">{t('vol.weightCheck', { lbs: lbs ?? plannedLbs })}</p>
              {adjust && (
                <input type="number" min={1} max={1000} value={lbs ?? plannedLbs} onChange={(e) => setLbs(Number(e.target.value))} aria-label="lbs" className="mt-2 min-h-[44px] w-32 rounded-xl border border-input bg-card px-3" />
              )}
              <div className="mt-2 flex gap-2">
                <Button onClick={pickup} loading={busy}>
                  {adjust ? t('vol.confirm') : t('vol.yes')}
                </Button>
                {!adjust && (
                  <Button variant="outline" onClick={() => setAdjust(true)}>
                    {t('vol.adjust')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {m.mine && m.status === 'picked_up' && (
        <Card className="border-2 border-accent p-4">
          <h2 className="font-extrabold">{t('vol.step2', { place: m.hub?.name })}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('vol.step2Body')}</p>
          <div className="mt-3">
            <CodeInput
              label={t('vol.dropCode')}
              value={dropCode}
              onChange={(v) => {
                setDropCode(v);
                setCodeError(null);
                setDropReady(v.length === 4);
              }}
              demoCode={m.demo_codes?.drop}
              error={codeError}
            />
          </div>
          {dropReady && (
            <div className="mt-3 rounded-xl bg-primary-soft p-3">
              <p className="flex items-start gap-2 font-semibold text-primary">
                <Package className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> {lang === 'es' ? m.bag_instructions_es : m.bag_instructions_en}
              </p>
              <Button variant="accent" size="lg" className="mt-3 w-full" onClick={dropoff} loading={busy}>
                {t('vol.done')}
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <h2 className="font-extrabold">{t('vol.brief')}</h2>
          {m.brief_source === 'ai' && <AiTag />}
        </div>
        <p className="mt-1.5 text-[15px]">{brief}</p>
        {m.requests?.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {m.requests.map((r) => `${r.code} · ${t('tonight.familyOf', { count: r.household_size })}`).join(' · ')}
          </p>
        )}
      </Card>

      <Suspense fallback={<div className="skeleton h-48" />}>
        <LiveMap live={live} height={200} focus={m.hub} />
      </Suspense>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {m.giver?.name} ({m.giver?.area_label}) → {m.hub?.name} ({m.hub?.area_label})
      </p>

      <Card className="p-4">
        <h2 className="flex items-center gap-2 font-extrabold">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" /> {t('vol.bringTitle')}
        </h2>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {t('vol.bringList').map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {steps.length > 0 && (
          <>
            <h2 className="mt-3 font-extrabold">{t('vol.steps')}</h2>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm">
              {steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </>
        )}
        {safety.length > 0 && (
          <>
            <h2 className="mt-3 font-extrabold">{t('vol.safety')}</h2>
            <ul className="mt-1 space-y-1 text-sm">
              {safety.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> {s}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {m.status === 'open' && !m.mine && (
        <Card className="p-4">
          {m.eligibility?.ok ? (
            <>
              <h2 className="font-extrabold">{t('vol.chooseBuddy')}</h2>
              <p className="text-sm text-muted-foreground">{t('vol.buddyRule')}</p>
              <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup">
                {(m.buddy_options || []).map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    role="radio"
                    aria-checked={buddy === b.key}
                    onClick={() => setBuddy(b.key)}
                    className={cn('min-h-[40px] rounded-full border px-3 text-sm font-semibold', buddy === b.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
                  >
                    {b.display_name}
                  </button>
                ))}
              </div>
              <Button variant="accent" size="lg" className="mt-3 w-full" onClick={claim} loading={busy} disabled={live.me?.age < 18 && !buddy}>
                {t('vol.claim')}
              </Button>
              {!hideHelpers && !buddy && m.buddy_options?.[0] && (
                <button type="button" className="mt-2 text-xs font-bold text-accent underline" onClick={() => setBuddy(m.buddy_options[0].key)}>
                  {t('demo.chip', { code: m.buddy_options[0].display_name })}
                </button>
              )}
            </>
          ) : (
            <p className="flex items-center gap-2 font-semibold text-muted-foreground">
              <Lock className="h-4 w-4" aria-hidden="true" /> {t('vol.locked')}: {(m.eligibility?.reasons || []).map((r) => t(`vol.reasons.${r}`)).join(' · ')}
            </p>
          )}
        </Card>
      )}

      <Sheet open={unsafeOpen} onClose={() => setUnsafeOpen(false)} title={t('vol.unsafe')}>
        <p>{t('vol.unsafeConfirm')}</p>
        <div className="mt-4 flex gap-2">
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await act('missionUnsafe', { mission_key: m.key, volunteer_key: identity });
                setUnsafeOpen(false);
                setUnsafeDone(true);
              } catch {
                /* toast shown */
              }
            }}
          >
            {t('vol.unsafeYes')}
          </Button>
          <Button as="a" href="tel:911" variant="outline">
            <Phone className="h-4 w-4" aria-hidden="true" /> 911
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
