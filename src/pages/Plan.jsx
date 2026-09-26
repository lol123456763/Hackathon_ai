import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ListChecks, LayoutGrid, Map as MapIcon, MessageCircleQuestion, Printer, Share2, Copy, Mail, MessageSquare, Volume2, VolumeX, RotateCcw, Pencil, ThumbsUp, ThumbsDown, MapPin, Search, Bookmark,
} from 'lucide-react';
import { useI18n, joinList } from '@/i18n';
import { api, IS_LOCAL } from '@/api/backend';
import { useFlow, lastPlan } from '@/state/flow';
import { useReadAloud } from '@/lib/speech';
import { CATEGORIES, CATEGORY_META } from '@/lib/categories';
import { Alert, Badge, Button, Card, Chip, Input, Spinner, Textarea, cn } from '@/components/ui';
import ActionPlan from '@/components/ActionPlan';
import ResourceCard from '@/components/ResourceCard';
import BenefitEstimates from '@/components/BenefitEstimates';
import FollowupChat from '@/components/FollowupChat';
import PlanLoading from '@/components/PlanLoading';

const ResourceMap = lazy(() => import('@/components/ResourceMap'));

function useDebouncedSave(token) {
  const timer = useRef(null);
  const pending = useRef({});
  return useCallback(
    (patch) => {
      pending.current = { ...pending.current, ...patch };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const p = pending.current;
        pending.current = {};
        api.updateProgress(token, p).catch(() => {});
      }, 600);
    },
    [token],
  );
}

function planToSpeech(plan, t) {
  if (!plan) return '';
  const parts = [`${t('plan.today')}.`, ...plan.today.map((s, i) => `${i + 1}. ${s.action}`)];
  if (plan.bring.length) parts.push(`${t('plan.bring')}:`, plan.bring.join('. '));
  if (plan.this_week.length) parts.push(`${t('plan.thisWeek')}.`, ...plan.this_week.map((s) => s.action));
  if (plan.fallbacks.length) parts.push(`${t('plan.fallbacks')}.`, ...plan.fallbacks.map((f) => `${f.if}: ${f.then}`));
  if (plan.encouragement) parts.push(plan.encouragement);
  return parts.join(' ');
}

function ShareBar({ token, plan }) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const reader = useReadAloud(lang);
  const url = `${window.location.origin}/plan/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: t('plan.emailSubject'), url });
        return;
      } catch {
        /* cancelled */
      }
    }
    copy();
  }

  const body = encodeURIComponent(t('plan.emailBody', { url }));
  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden="true" /> {t('plan.actions.print')}
      </Button>
      <Button variant="outline" size="sm" onClick={share}>
        <Share2 className="h-4 w-4" aria-hidden="true" /> {t('plan.actions.share')}
      </Button>
      <Button variant="outline" size="sm" onClick={copy} aria-live="polite">
        <Copy className="h-4 w-4" aria-hidden="true" /> {copied ? t('plan.actions.copied') : t('plan.actions.copy')}
      </Button>
      <Button as="a" variant="outline" size="sm" href={`mailto:?subject=${encodeURIComponent(t('plan.emailSubject'))}&body=${body}`}>
        <Mail className="h-4 w-4" aria-hidden="true" /> {t('plan.actions.email')}
      </Button>
      <Button as="a" variant="outline" size="sm" href={`sms:?&body=${body}`} className="sm:hidden">
        <MessageSquare className="h-4 w-4" aria-hidden="true" /> {t('plan.actions.sms')}
      </Button>
      {reader.supported && (
        <Button variant="outline" size="sm" onClick={() => (reader.speaking ? reader.stop() : reader.speak(planToSpeech(plan, t)))} aria-pressed={reader.speaking}>
          {reader.speaking ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          {reader.speaking ? t('plan.actions.stopReading') : t('plan.actions.readAloud')}
        </Button>
      )}
    </div>
  );
}

function Feedback({ token }) {
  const { t, lang } = useI18n();
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);

  async function send(r, c) {
    try {
      await api.submitFeedback({ plan_token: token, rating: r, comment: c || undefined, language: lang });
    } catch {
      /* best effort */
    }
  }

  if (sent) return <Alert variant="success">{t('plan.feedbackThanks')}</Alert>;
  return (
    <Card className="no-print p-5">
      <p className="font-semibold">{t('plan.feedbackQ')}</p>
      <div className="mt-3 flex gap-2">
        <Button
          variant={rating === 'helpful' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setRating('helpful');
            send('helpful');
            setSent(true);
          }}
        >
          <ThumbsUp className="h-4 w-4" aria-hidden="true" /> {t('plan.feedbackYes')}
        </Button>
        <Button variant={rating === 'not_helpful' ? 'primary' : 'outline'} size="sm" onClick={() => setRating('not_helpful')}>
          <ThumbsDown className="h-4 w-4" aria-hidden="true" /> {t('plan.feedbackNo')}
        </Button>
      </div>
      {rating === 'not_helpful' && (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            send('not_helpful', comment.trim());
            setSent(true);
          }}
        >
          <label htmlFor="fb" className="text-sm text-muted-foreground">
            {t('plan.feedbackComment')}
          </label>
          <Textarea id="fb" rows={3} maxLength={1000} className="mt-1" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button type="submit" size="sm" className="mt-2">
            {t('plan.feedbackSend')}
          </Button>
        </form>
      )}
    </Card>
  );
}

function ResourcesTab({ view, checklist, saved, onToggleSaved, onCheck, focusId }) {
  const { t, field } = useI18n();
  const [cats, setCats] = useState([]);
  const [modes, setModes] = useState([]);
  const [sort, setSort] = useState('best');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!focusId) return;
    setCats([]);
    setModes([]);
    setQuery('');
    requestAnimationFrame(() => {
      const el = document.getElementById(`res-${focusId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el?.closest('article')?.classList.add('ring-2', 'ring-accent');
      setTimeout(() => el?.closest('article')?.classList.remove('ring-2', 'ring-accent'), 2500);
    });
  }, [focusId]);

  const items = view.matches.map((m) => ({ match: m, resource: view.resources[m.slug] })).filter((x) => x.resource);
  const availableCats = CATEGORIES.filter((c) => items.some((x) => (x.match.matched_categories || []).includes(c)));
  const q = query.trim().toLowerCase();
  let filtered = items.filter(({ match, resource }) => {
    if (cats.length && !cats.some((c) => (match.matched_categories || resource.categories || []).includes(c))) return false;
    if (modes.includes('online') && !resource.apply_online) return false;
    if (modes.includes('walk_in') && !resource.walk_in) return false;
    if (modes.includes('phone') && !resource.phone) return false;
    if (q && !`${resource.name} ${resource.organization} ${field(resource, 'description')}`.toLowerCase().includes(q)) return false;
    return true;
  });
  if (sort === 'nearest') filtered = [...filtered].sort((a, b) => (a.match.distance ?? 9999) - (b.match.distance ?? 9999));

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const savedItems = items.filter((x) => saved.includes(x.resource.id));

  return (
    <div className="space-y-5">
      {savedItems.length > 0 && (
        <div className="rounded-xl border bg-accent-soft/60 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Bookmark className="h-4 w-4" aria-hidden="true" /> {t('plan.savedSection')}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {savedItems.map(({ resource }) => (
              <li key={resource.id}>
                <a href={`#res-${resource.id}`} className="inline-flex rounded-full bg-card px-3 py-1 text-sm font-medium underline-offset-2 hover:underline">
                  {resource.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="no-print space-y-3 rounded-xl border bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="res-search" className="sr-only">
            {t('filters.search')}
          </label>
          <Input id="res-search" className="pl-9" placeholder={t('filters.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('filters.title')}>
          <Chip selected={!cats.length} onClick={() => setCats([])}>
            {t('filters.all')}
          </Chip>
          {availableCats.map((c) => (
            <Chip key={c} selected={cats.includes(c)} onClick={() => toggle(cats, setCats, c)}>
              {t(`categories.${c}`)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            ['online', t('filters.online')],
            ['walk_in', t('filters.walkIn')],
            ['phone', t('filters.phone')],
          ].map(([id, label]) => (
            <Chip key={id} selected={modes.includes(id)} onClick={() => toggle(modes, setModes, id)}>
              {label}
            </Chip>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('filters.sort')}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="min-h-[40px] rounded-lg border border-input bg-card px-2">
              <option value="best">{t('filters.sortBest')}</option>
              <option value="nearest">{t('filters.sortNearest')}</option>
            </select>
          </label>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t('filters.showing', { count: filtered.length })}
          {(cats.length > 0 || modes.length > 0 || q) && (
            <button
              type="button"
              className="ml-2 font-semibold text-primary underline"
              onClick={() => {
                setCats([]);
                setModes([]);
                setQuery('');
              }}
            >
              {t('filters.clear')}
            </button>
          )}
        </p>
      </div>
      <div className="grid gap-4">
        {filtered.map(({ match, resource }) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            match={match}
            planToken={view.token}
            saved={saved.includes(resource.id)}
            done={!!checklist[`res.${resource.id}`]}
            onToggleSaved={() => onToggleSaved(resource.id)}
            onToggleDone={() => onCheck(`res.${resource.id}`, !checklist[`res.${resource.id}`])}
          />
        ))}
      </div>
      {!filtered.length && <p className="text-center text-muted-foreground">{t('browse.empty')}</p>}
    </div>
  );
}

export default function Plan() {
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const flow = useFlow();
  const [view, setView] = useState(location.state?.view?.token === token ? location.state.view : null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('plan');
  const [personalizing, setPersonalizing] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [checklist, setChecklist] = useState(view?.checklist_state || {});
  const [saved, setSaved] = useState(view?.saved_resources || []);
  const [focusId, setFocusId] = useState(null);
  const save = useDebouncedSave(token);
  const tabsRef = useRef(null);
  const langRef = useRef(view?.language);

  // Load the plan if we did not arrive with it.
  useEffect(() => {
    if (view) return;
    let alive = true;
    api
      .getPlan(token)
      .then((v) => {
        if (!alive) return;
        setView(v);
        setChecklist(v.checklist_state || {});
        setSaved(v.saved_resources || []);
        langRef.current = v.language;
        lastPlan.set(v.token, v.created_date);
      })
      .catch((e) => alive && setError(e?.code === 'plan_not_found' || e?.code === 'invalid_token' ? 'notFound' : 'error'));
    return () => {
      alive = false;
    };
  }, [token, view]);

  const personalize = useCallback(
    async (language) => {
      if (IS_LOCAL) return;
      setPersonalizing(true);
      setAiFailed(false);
      try {
        const v = await api.personalizePlan(token, language);
        setView(v);
        setChecklist(v.checklist_state || {});
        langRef.current = v.language;
        if (v.plan_source !== 'ai') setAiFailed(true);
      } catch {
        setAiFailed(true);
      } finally {
        setPersonalizing(false);
      }
    },
    [token],
  );

  // A fresh plan starts with the instant rule-based plan; upgrade it with AI in the background.
  const started = useRef(false);
  useEffect(() => {
    if (!view || started.current) return;
    started.current = true;
    if (view.plan_source !== 'ai' && location.state?.fresh) personalize(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Language switch: rebuild the plan text in the new language.
  useEffect(() => {
    if (!view || !langRef.current || langRef.current === lang) return;
    langRef.current = lang;
    if (IS_LOCAL) {
      api.relocalizePlan(token, lang).then((v) => {
        setView(v);
        setChecklist(v.checklist_state || {});
      });
    } else {
      api
        .relocalizePlan(token, lang)
        .then((v) => {
          setView(v);
          setChecklist({});
        })
        .finally(() => personalize(lang));
    }
  }, [lang, view, token, personalize]);

  useEffect(() => {
    const onShow = (e) => {
      setTab('resources');
      setFocusId(null);
      setTimeout(() => setFocusId(e.detail), 0);
    };
    window.addEventListener('bb:show-resource', onShow);
    return () => window.removeEventListener('bb:show-resource', onShow);
  }, []);

  const onCheck = useCallback(
    (key, value) => {
      setChecklist((c) => {
        const next = { ...c, [key]: value };
        save({ checklist_state: next });
        return next;
      });
    },
    [save],
  );

  const onToggleSaved = useCallback(
    (id) => {
      setSaved((s) => {
        const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
        save({ saved_resources: next });
        return next;
      });
    },
    [save],
  );

  const mapItems = useMemo(
    () => (view ? view.matches.filter((m) => !m.fallback).map((m) => ({ match: m, resource: view.resources[m.slug] })).filter((x) => x.resource) : []),
    [view],
  );

  if (error) {
    return (
      <div className="container-page max-w-2xl py-12">
        <Alert variant={error === 'notFound' ? 'warning' : 'danger'} title={error === 'notFound' ? t('plan.notFound') : t('common.error')}>
          <div className="mt-3 flex gap-2">
            <Button as={Link} to="/">
              {t('plan.startNew')}
            </Button>
            {error !== 'notFound' && (
              <Button variant="outline" onClick={() => { setError(null); setView(null); }}>
                {t('common.tryAgain')}
              </Button>
            )}
          </div>
        </Alert>
      </div>
    );
  }
  if (!view) return <PlanLoading />;

  const p = view.profile || {};
  const realMatches = view.matches.filter((m) => !m.fallback);
  const summaryBits = [
    p.household_size ? t('plan.household', { count: p.household_size }) : null,
    p.children_count ? (p.children_count === 1 ? t('plan.kidsOne') : t('plan.kidsMany', { count: p.children_count })) : null,
    p.situations?.includes('job_loss') ? t('situations.job_loss').toLowerCase() : null,
    p.needs?.length ? t('plan.needsLabel', { list: joinList(p.needs.map((n) => t(`categories.${n}`).toLowerCase()), lang) }) : null,
    p.zip ? `${t('plan.zip', { zip: p.zip })}${view.county ? ` (${t('plan.county', { county: view.county })})` : ''}` : null,
  ].filter(Boolean);

  const TABS = [
    ['plan', ListChecks, t('plan.tabs.plan')],
    ['resources', LayoutGrid, `${t('plan.tabs.resources')} (${realMatches.length})`],
    ['map', MapIcon, t('plan.tabs.map')],
    ...(IS_LOCAL ? [] : [['ask', MessageCircleQuestion, t('plan.tabs.ask')]]),
  ];

  function onTabKey(e) {
    const ids = TABS.map((x) => x[0]);
    const i = ids.indexOf(tab);
    let next = null;
    if (e.key === 'ArrowRight') next = ids[(i + 1) % ids.length];
    if (e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length];
    if (next) {
      e.preventDefault();
      setTab(next);
      tabsRef.current?.querySelector(`#tab-${next}`)?.focus();
    }
  }

  return (
    <div className="container-page max-w-4xl py-6 sm:py-10">
      <div className="print-only mb-4 text-xl font-bold">BenefitBridge · {t('app.tagline')}</div>
      <header className="animate-fade-up">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('plan.summaryTitle')}</p>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{t('plan.matchesFound', { count: realMatches.length })}</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {t('plan.summary')}: {summaryBits.join(', ')}.
        </p>
        <div className="no-print mt-3 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Works on any device: reload this plan's answers into the wizard.
              flow.reset();
              flow.update({ profile: { ...p }, prefilled: [], fromText: false, crisis: false });
              navigate('/start');
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" /> {t('plan.actions.editAnswers')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              flow.reset();
              lastPlan.clear();
              navigate('/');
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t('plan.actions.startOver')}
          </Button>
        </div>
      </header>

      {view.place && view.place.valid && !view.place.inTexas && (
        <Alert variant="warning" className="mt-5">
          {t('plan.outOfTexas')}
        </Alert>
      )}
      {view.place?.approximate && (
        <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" aria-hidden="true" /> {t('plan.approximateZip')}
        </p>
      )}
      {realMatches.length === 0 && (
        <Alert variant="warning" className="mt-5" title={t('plan.noMatches')}>
          {t('plan.noMatchesHint')}
        </Alert>
      )}

      <div className="mt-6">
        <ShareBar token={view.token} plan={view.action_plan} />
      </div>

      <div ref={tabsRef} role="tablist" aria-label={t('plan.summaryTitle')} onKeyDown={onTabKey} className="no-print sticky top-16 z-30 -mx-4 mt-6 flex gap-1 overflow-x-auto border-b bg-background/95 px-4 backdrop-blur sm:mx-0 sm:px-0">
        {TABS.map(([id, Icon, label]) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            type="button"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex min-h-[48px] shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition',
              tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <div id="panel-plan" role="tabpanel" aria-labelledby="tab-plan" hidden={tab !== 'plan'} className="space-y-10 print:block">
          <ActionPlan
            plan={{ ...view.action_plan, source: view.plan_source }}
            resources={view.resources}
            checklist={checklist}
            onCheck={onCheck}
            personalizing={personalizing}
            aiFailed={aiFailed}
            onRetry={() => personalize(lang)}
            isLocal={IS_LOCAL}
          />
          <BenefitEstimates estimates={view.estimates} />
          <Feedback token={view.token} />
        </div>
        <div id="panel-resources" role="tabpanel" aria-labelledby="tab-resources" hidden={tab !== 'resources'}>
          {tab === 'resources' && <ResourcesTab view={view} checklist={checklist} saved={saved} onToggleSaved={onToggleSaved} onCheck={onCheck} focusId={focusId} />}
        </div>
        <div id="panel-map" role="tabpanel" aria-labelledby="tab-map" hidden={tab !== 'map'} className="no-print">
          {tab === 'map' && (
            <Suspense fallback={<Spinner label={t('map.loading')} />}>
              <ResourceMap place={view.place} items={mapItems} />
            </Suspense>
          )}
        </div>
        {!IS_LOCAL && (
          <div id="panel-ask" role="tabpanel" aria-labelledby="tab-ask" hidden={tab !== 'ask'} className="no-print">
            {tab === 'ask' && <FollowupChat token={view.token} resources={view.resources} />}
          </div>
        )}
      </div>

      <p className="mt-10 rounded-xl border bg-card p-4 text-sm text-muted-foreground">{t('plan.disclaimer')}</p>
      <div className="no-print mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {CATEGORIES.filter((c) => p.needs?.includes(c)).map((c) => {
          const Icon = CATEGORY_META[c].icon;
          return (
            <Badge key={c}>
              <Icon className="h-3 w-3" aria-hidden="true" /> {t(`categories.${c}`)}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
