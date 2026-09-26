import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Copy, RotateCcw, Volume2, VolumeX, Printer, Pencil, Languages, Check } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { useFlow } from '@/state/flow';
import { useReadAloud } from '@/lib/speech';
import { session } from '@/lib/storage';
import { CATEGORY_META } from '@/lib/categories';
import { Alert, Button, Card, CheckItem, cn } from '@/components/ui';
import { AiTag } from '@/components/bits';
import ResourceCard from '@/components/ResourceCard';
import TonightCard from '@/components/TonightCard';
import { Icon } from '@/components/icons';
import { Loopy } from '@/components/decor';
import PlanLoading from '@/components/PlanLoading';

const PERSONALIZED = 'loop.personalized';

function useDebouncedSave(act, token) {
  const timer = useRef(null);
  return useCallback(
    (checklist) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => act('updateProgress', { token, checklist_state: checklist }, { silent: true }).catch(() => {}), 500);
    },
    [act, token],
  );
}

function Chips({ profile, t }) {
  const chips = [];
  if (profile.household_size) chips.push(t('help.chips.household', { count: profile.household_size }));
  if (profile.children_count) chips.push(profile.children_count === 1 ? t('help.chips.kid') : t('help.chips.kids', { count: profile.children_count }));
  if (profile.child_under_5) chips.push(t('help.chips.under5'));
  for (const s of profile.situations || []) chips.push(t(`situations.${s}`).toLowerCase());
  for (const n of profile.needs || []) chips.push(`${t(`chipCategories.${n}`)}${n === 'food' && profile.urgency === 'today' ? ` ${t('help.chips.today')}` : ''}`);
  if (profile.zip) chips.push(t('help.chips.zip', { zip: profile.zip }));
  return (
    <ul className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <li key={c} className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
          {c}
        </li>
      ))}
    </ul>
  );
}

function StepList({ steps, resources, checklist, onCheck, prefix, startIndex = 0, t }) {
  return (
    <ol className="divide-y-2 divide-dotted divide-border rounded-[22px] bg-card px-3 shadow-soft">
      {steps.map((s, i) => {
        const key = `${prefix}.${i}`;
        const done = !!checklist[key];
        const r = resources[s.resource_id];
        return (
          <li key={key} className="relative py-3 pl-10">
            {/* dashed thread linking the steps */}
            <span className={cn('absolute left-[13px] border-l-2 border-dashed border-primary/30', i === 0 ? 'top-6' : 'top-0', i === steps.length - 1 ? 'h-6' : 'bottom-0')} aria-hidden="true" />
            <span className={cn('absolute left-0 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors', done ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/40 bg-card text-primary')} aria-hidden="true">
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : startIndex + i + 1}
            </span>
            <div>
              <p className={cn('font-semibold leading-snug', done && 'text-muted-foreground line-through')}>{s.action}</p>
              {s.why && <p className="mt-0.5 text-sm text-muted-foreground">{s.why}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                {r && (
                  <a
                    href={`#res-${r.id}`}
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(`res-${r.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    {t('plan.seeProgram')}
                  </a>
                )}
                <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 font-semibold">
                  <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={done} onChange={(e) => onCheck(key, e.target.checked)} />
                  {done ? t('plan.done') : t('plan.markDone')}
                </label>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function planText(plan, t) {
  if (!plan) return '';
  const parts = [];
  if (plan.today.length) parts.push(`${t('plan.today')}.`, ...plan.today.map((s) => s.action));
  if (plan.this_week.length) parts.push(`${t('plan.thisWeek')}.`, ...plan.this_week.map((s) => s.action));
  if (plan.bring.length) parts.push(`${t('plan.bring')}:`, plan.bring.join('. '));
  if (plan.fallbacks.length) parts.push(`${t('plan.fallbacks')}.`, ...plan.fallbacks.map((f) => `${f.if}: ${f.then}`));
  if (plan.encouragement) parts.push(plan.encouragement);
  return parts.join(' ');
}

export default function MyPlan() {
  const { token } = useParams();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { act, live, setToken, token: myToken } = useApp();
  const flow = useFlow();
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [personalizing, setPersonalizing] = useState(false);
  const [checklist, setChecklist] = useState({});
  const [copied, setCopied] = useState(false);
  const save = useDebouncedSave(act, token);
  const reader = useReadAloud(lang);
  const viewLang = useRef(null);

  const applyView = useCallback((v) => {
    setView(v);
    setChecklist(v.checklist_state || {});
    viewLang.current = v.language;
  }, []);

  const personalize = useCallback(
    async (language) => {
      setPersonalizing(true);
      try {
        applyView(await act('personalizePlan', { token, language }, { silent: true }));
        const done = session.getJson(PERSONALIZED, {});
        session.setJson(PERSONALIZED, { ...done, [token]: language });
      } catch {
        /* the rule-based plan stays */
      } finally {
        setPersonalizing(false);
      }
    },
    [act, token, applyView],
  );

  useEffect(() => {
    let alive = true;
    setError(null);
    act('getPlan', { token }, { silent: true })
      .then((v) => {
        if (!alive) return;
        applyView(v);
        if (token !== myToken) setToken(token);
        const done = session.getJson(PERSONALIZED, {});
        if (done[token] !== lang) personalize(lang);
      })
      .catch((e) => alive && setError(e?.code === 'plan_not_found' || e?.code === 'invalid_token' ? 'notFound' : 'error'));
    return () => {
      alive = false;
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Language switch → rewrite the plan in the new language.
  useEffect(() => {
    if (view && viewLang.current && viewLang.current !== lang && !personalizing) {
      viewLang.current = lang;
      personalize(lang);
    }
  }, [lang, view, personalize, personalizing]);

  const request = (live?.my_request && myToken === token ? live.my_request : null) || view?.request || null;

  const groups = useMemo(() => {
    if (!view) return [];
    const map = new Map();
    for (const m of view.matches) {
      const r = view.resources[m.slug];
      if (!r) continue;
      const cat = m.fallback ? 'zz_fallback' : m.matched_categories?.[0] || r.categories?.[0] || 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push({ m, r });
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [view]);

  if (error) {
    return (
      <div className="pt-4">
        <Alert variant="warning" title={error === 'notFound' ? t('plan.notFound') : t('errors.generic')}>
          <Button as={Link} to="/help" className="mt-3" size="sm">
            {t('plan.startNew')}
          </Button>
        </Alert>
      </div>
    );
  }
  if (!view) return <PlanLoading />;

  const plan = view.plan;
  const onCheck = (key, value) => {
    setChecklist((c) => {
      const next = { ...c, [key]: value };
      save(next);
      return next;
    });
  };
  const showLangOffer = flow.detectedLanguage && flow.detectedLanguage !== lang && flow.lastToken === token;
  const understood = flow.lastToken === token ? flow.understood : null;
  const summaryText = understood ? (lang === 'es' ? understood.summary_es : understood.summary_en) : null;
  const outOfArea = view.place?.valid && !view.tonight?.networkActive;

  return (
    <div className="space-y-6 pt-2">
      <div className="print-only text-xl font-bold">Loop — {t('tabs.myPlan')}</div>
      {showLangOffer && (
        <Alert
          variant="info"
          title={flow.detectedLanguage === 'es' ? t('help.switchLang') : t('help.switchLangEn')}
          action={
            <Button size="sm" onClick={() => setLang(flow.detectedLanguage)}>
              <Languages className="h-4 w-4" aria-hidden="true" /> {t('help.switchYes')}
            </Button>
          }
        />
      )}

      <section aria-labelledby="understood-title">
        <div className="flex items-center justify-between gap-2">
          <h1 id="understood-title" className="text-lg font-extrabold">
            {t('help.understood')}
          </h1>
          <Button
            variant="ghost"
            size="sm"
            className="no-print"
            onClick={() => {
              flow.reset();
              flow.update({ profile: { ...view.profile, zip: view.profile.zip || '' }, fromText: false, prefilled: [] });
              navigate('/help/questions');
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" /> {t('plan.edit')}
          </Button>
        </div>
        {summaryText && (
          <p className="mt-1 text-sm text-muted-foreground">
            {summaryText} {understood?.ai && <AiTag className="ml-1 align-middle" />}
          </p>
        )}
        <div className="mt-2">
          <Chips profile={view.profile} t={t} />
        </div>
      </section>

      {outOfArea && <Alert variant="warning" title={t('plan.waitlistTitle')}>{t('plan.outOfArea')}</Alert>}

      <TonightCard view={view} request={request} onPlanChange={applyView} />

      <section aria-labelledby="today-title" aria-busy={personalizing || undefined} className={cn('transition', personalizing && 'opacity-60')}>
        <div className="mb-2 flex items-center gap-2">
          <Icon name="today" tone="sun" className="h-6 w-6" />
          <h2 id="today-title" className="text-lg font-extrabold">
            {t('plan.today')}
          </h2>
          {view.plan_source === 'ai' && <AiTag />}
          {personalizing && <span className="ml-auto text-xs text-muted-foreground" role="status">{t('plan.personalizing')}</span>}
        </div>
        <StepList t={t} steps={plan.today} resources={view.resources} checklist={checklist} onCheck={onCheck} prefix="today" />
      </section>

      {plan.this_week.length > 0 && (
        <section aria-labelledby="week-title" className={cn('transition', personalizing && 'opacity-60')}>
          <h2 id="week-title" className="mb-2 flex items-center gap-2 text-lg font-extrabold">
            <Icon name="week" className="h-6 w-6" /> {t('plan.thisWeek')}
          </h2>
          <StepList t={t} steps={plan.this_week} resources={view.resources} checklist={checklist} onCheck={onCheck} prefix="week" startIndex={plan.today.length} />
        </section>
      )}

      <section aria-labelledby="bring-title">
        <h2 id="bring-title" className="flex items-center gap-2 text-lg font-extrabold">
          <Icon name="plan" tone="sun" className="h-6 w-6" /> {t('plan.bring')}
        </h2>
        <p className="mb-2 text-sm text-muted-foreground">{t('plan.bringHint')}</p>
        <Card kind="note" tilt={3} className="mt-4 grid gap-0.5 p-2 pt-4">
          {plan.bring.map((d, i) => (
            <CheckItem key={i} className="border-0 bg-transparent hover:bg-ink/5" checked={!!checklist[`bring.${i}`]} onChange={(c) => onCheck(`bring.${i}`, c)}>
              {d}
            </CheckItem>
          ))}
        </Card>
      </section>

      {plan.fallbacks.length > 0 && (
        <section aria-labelledby="fb-title">
          <h2 id="fb-title" className="mb-2 flex items-center gap-2 text-lg font-extrabold">
            <Icon name="help" tone="tomato" className="h-6 w-6" /> {t('plan.fallbacks')}
          </h2>
          <ul className="space-y-1.5">
            {plan.fallbacks.map((f, i) => (
              <li key={i} className="rounded-[16px] border-2 border-dashed border-border p-3 text-sm">
                <span className="font-semibold">{f.if}</span> → {f.then}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.encouragement && (
        <div className="flex items-center gap-3 px-1">
          <Loopy mood="happy" size={56} />
          <p className="hand -rotate-1 text-[21px] leading-tight text-primary">{plan.encouragement}</p>
        </div>
      )}

      <section aria-labelledby="programs-title">
        <h2 id="programs-title" className="mb-2 text-lg font-extrabold">
          {t('plan.programs')}
        </h2>
        <div className="space-y-5">
          {groups.map(([cat, items]) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta?.icon;
            return (
              <div key={cat}>
                {meta && (
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden="true" /> {t(`categories.${cat}`)}
                  </h3>
                )}
                <div className="space-y-3">
                  {items.map(({ m, r }) => (
                    <ResourceCard key={r.id} id={`res-${r.id}`} resource={r} match={m} done={!!checklist[`res.${r.id}`]} onToggleDone={() => onCheck(`res.${r.id}`, !checklist[`res.${r.id}`])} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="no-print flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const url = `${window.location.origin}/p/${token}`;
            try {
              await navigator.clipboard.writeText(url);
            } catch {
              window.prompt(t('plan.copyLink'), url);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Copy className="h-4 w-4" aria-hidden="true" /> {copied ? t('plan.copied') : t('plan.copyLink')}
        </Button>
        {reader.supported && (
          <Button variant="outline" size="sm" onClick={() => (reader.speaking ? reader.stop() : reader.speak(planText(plan, t)))} aria-pressed={reader.speaking}>
            {reader.speaking ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />} {reader.speaking ? t('plan.stopReading') : t('plan.readAloud')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" /> {t('plan.print')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            flow.reset();
            setToken(null);
            navigate('/help');
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t('plan.startOver')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('plan.linkNote')}</p>
      <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">{t('plan.disclaimer')}</p>
    </div>
  );
}
