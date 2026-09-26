import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Plus, Upload, SlidersHorizontal, Check, ArrowRightLeft, X, Users, MapPin, Home, Flame, Clock, CalendarPlus, FileUp } from 'lucide-react';
import { useI18n, joinList } from '@/i18n';
import { useApp } from '@/state/app';
import { hhmmLabel, fmtHours } from '@/lib/format';
import { AiTag, CodeInput, Sheet } from '@/components/bits';
import { Alert, Button, Card, CheckItem, Chip, Input, Skeleton, Textarea, cn } from '@/components/ui';

const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const PX = 0.9; // pixels per minute on the day timeline
const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};
const KIND_STYLE = {
  school: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-slate-100',
  homework: 'bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-900/50 dark:text-violet-100',
  activity: 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/50 dark:text-sky-100',
  personal: 'bg-stone-100 text-stone-800 border-stone-200 dark:bg-stone-800 dark:text-stone-100',
  loop: 'bg-primary text-primary-foreground border-primary',
};

function dayLabel(date, lang, style = 'short') {
  return new Date(`${date}T12:00:00`).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: style });
}

function useCoordinator(identity, lang) {
  const { act } = useApp();
  const [data, setData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const seq = useRef(0);
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      // Fast deterministic plan first, then the AI explanations.
      const fast = await act('coordinator', { volunteer_key: identity, language: lang, with_ai: false }, { silent: true });
      if (my !== seq.current) return;
      setData(fast);
      setAiLoading(true);
      const full = await act('coordinator', { volunteer_key: identity, language: lang, with_ai: true }, { silent: true });
      if (my === seq.current) setData(full);
    } catch {
      /* keep what we have */
    } finally {
      if (my === seq.current) setAiLoading(false);
    }
  }, [act, identity, lang]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, reload: load, aiLoading };
}

function Likelihood({ p, factors }) {
  const { t } = useI18n();
  const tone = p >= 80 ? 'bg-success' : p >= 60 ? 'bg-accent' : 'bg-muted-foreground';
  return (
    <div title={t('week.likelyHint')}>
      <div className="flex items-center justify-between text-xs font-semibold">
        <span>{t('week.likely', { p })}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-1.5 rounded-full', tone)} style={{ width: `${p}%` }} />
      </div>
      {factors?.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{factors.map((f) => t(`week.likelihoodFactors.${f}`)).join(' · ')}</p>}
    </div>
  );
}

function reasonText(s, t, lang) {
  const ai = lang === 'es' ? s.reason_es : s.reason_en;
  if (ai) return { text: ai, ai: true };
  const parts = s.factors.map((f) => {
    const p = f.params || {};
    if (f.code === 'interest') return t('week.reasons.interest', { interests: joinList(p.interests.map((i) => t(`interests.${i}`).toLowerCase()), lang) });
    if (f.code === 'urgent') return t('week.reasons.urgent', { families: p.families });
    if (f.code === 'need') return t('week.reasons.need');
    if (f.code === 'free') return p.before >= 90 && p.after >= 90 ? t('week.reasons.freeLots') : t('week.reasons.free', { before: p.before, after: p.after });
    if (f.code === 'buddy') return t('week.reasons.buddy', { name: p.name });
    return null;
  });
  return { text: parts.filter(Boolean).join(' '), ai: false };
}

function SuggestionCard({ s, onAccept, onMove, onDecline, busy }) {
  const { t, lang } = useI18n();
  const [buddy, setBuddy] = useState(s.buddies[0]?.key || null);
  const r = reasonText(s, t, lang);
  return (
    <Card id={`s-${s.opp_key}`} className="scroll-mt-20 animate-fade-up border-2 border-dashed border-accent/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">
            {dayLabel(s.date, lang, 'long')} · {hhmmLabel(s.start, lang)}–{hhmmLabel(s.end, lang)}
          </p>
          <h3 className="mt-0.5 font-bold leading-snug">{lang === 'es' ? s.title_es : s.title_en}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {s.remote ? (
              <span className="inline-flex items-center gap-1"><Home className="h-3 w-3" aria-hidden="true" /> {t('week.remote')}</span>
            ) : (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" /> {s.place}{s.distance != null && ` · ${t('week.distance', { mi: s.distance })}`}</span>
            )}
            <span>{t('week.hours', { h: fmtHours(s.hours_credit) })}</span>
          </p>
        </div>
        {s.families > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger">
            <Flame className="h-3 w-3" aria-hidden="true" /> {t('week.families', { count: s.families })}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm">
        {r.text} {r.ai && <AiTag className="ml-1 align-middle" />}
      </p>
      {(lang === 'es' ? s.impact_es : s.impact_en) && <p className="mt-1 text-sm font-semibold text-primary">{lang === 'es' ? s.impact_es : s.impact_en}</p>}
      <div className="mt-3">
        <Likelihood p={s.likelihood} factors={s.likelihood_factors} />
      </div>
      {s.buddies.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden="true" /> {t('week.chooseBuddy')}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {s.buddies.map((b) => (
              <Chip key={b.key} selected={buddy === b.key} onClick={() => setBuddy(buddy === b.key ? null : b.key)} className="min-h-[34px] text-xs">
                {t('week.withBuddy', { name: b.display_name })}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button variant="accent" size="sm" className="flex-1" onClick={() => onAccept(s, buddy)} loading={busy === s.opp_key}>
          <Check className="h-4 w-4" aria-hidden="true" /> {t('week.accept')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => onMove(s)}>
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" /> {t('week.move')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDecline(s)} aria-label={t('week.decline')}>
          <X className="h-4 w-4" aria-hidden="true" /> <span className="sr-only min-[400px]:not-sr-only">{t('week.decline')}</span>
        </Button>
      </div>
    </Card>
  );
}

function Timeline({ day, suggestions, onBlock, onSuggestion, isToday, nowMin }) {
  const { t, lang } = useI18n();
  const height = (DAY_END - DAY_START) * PX;
  const top = (hhmm) => (Math.max(DAY_START, Math.min(DAY_END, toMin(hhmm))) - DAY_START) * PX;
  const hours = [];
  for (let h = 7; h <= 21; h++) hours.push(h);
  return (
    <div className="relative mt-2 flex" style={{ height }} aria-label={t('week.title')}>
      <div className="relative w-12 shrink-0" aria-hidden="true">
        {hours.map((h) => (
          <span key={h} className="absolute -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: (h * 60 - DAY_START) * PX }}>
            {hhmmLabel(`${String(h).padStart(2, '0')}:00`, lang).replace(':00', '')}
          </span>
        ))}
      </div>
      <div className="relative flex-1 border-l">
        {hours.map((h) => (
          <div key={h} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: (h * 60 - DAY_START) * PX }} />
        ))}
        {day.free.map((w) => (
          <div key={w.start} className="absolute inset-x-1 rounded-lg bg-success-soft/70" style={{ top: top(w.start), height: Math.max(12, (toMin(w.end) - toMin(w.start)) * PX) }}>
            {w.minutes >= 45 && <span className="absolute right-2 top-1 text-[10px] font-semibold text-success">{t('week.freeWindow', { start: hhmmLabel(w.start, lang), end: hhmmLabel(w.end, lang) })}</span>}
          </div>
        ))}
        {isToday && nowMin >= DAY_START && nowMin <= DAY_END && (
          <div className="absolute inset-x-0 z-20 h-0.5 bg-danger" style={{ top: (nowMin - DAY_START) * PX }} aria-hidden="true">
            <span className="absolute -left-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-danger" />
          </div>
        )}
        {day.blocks.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => onBlock(b)}
            className={cn('absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-2 py-0.5 text-left text-xs font-semibold shadow-sm transition hover:brightness-95', KIND_STYLE[b.kind] || KIND_STYLE.personal, b.status === 'done' && 'opacity-70')}
            style={{ top: top(b.start), height: Math.max(22, (toMin(b.end) - toMin(b.start)) * PX - 2) }}
          >
            {b.kind === 'loop' && <Sparkles className="mr-1 inline h-3 w-3" aria-hidden="true" />}
            {b.kind === 'loop' && lang === 'es' && b.title_es ? b.title_es : b.title} <span className="font-normal opacity-80">{hhmmLabel(b.start, lang)}–{hhmmLabel(b.end, lang)}</span>
            {b.status === 'done' && ' ✓'}
          </button>
        ))}
        {suggestions.map((s) => (
          <button
            key={s.opp_key}
            type="button"
            onClick={() => onSuggestion(s)}
            className="absolute inset-x-1 z-10 overflow-hidden rounded-lg border-2 border-dashed border-accent bg-accent-soft/90 px-2 py-0.5 text-left text-xs font-bold text-accent"
            style={{ top: top(s.start), height: Math.max(24, (toMin(s.end) - toMin(s.start)) * PX - 2) }}
          >
            ✦ {lang === 'es' ? s.title_es : s.title_en}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddBlockSheet({ open, onClose, date, onSaved }) {
  const { t } = useI18n();
  const { act, identity } = useApp();
  const [f, setF] = useState({ title: '', kind: 'activity', repeat: true, days: [], date, start: '16:00', end: '17:00' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF((x) => ({ ...x, date, days: x.days.length ? x.days : [new Date(`${date}T12:00:00`).getDay()] }));
  }, [open, date]);
  const wd = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <Sheet open={open} onClose={onClose} title={t('week.addTitle')}>
      <div className="space-y-3">
        <label className="block text-sm font-semibold">
          {t('week.blockTitle')}
          <Input className="mt-1 min-h-[44px] font-normal" value={f.title} maxLength={60} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {['school', 'homework', 'activity', 'personal'].map((k) => (
            <Chip key={k} selected={f.kind === k} onClick={() => setF({ ...f, kind: k })}>
              {t(`week.kind.${k}`)}
            </Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <Chip selected={f.repeat} onClick={() => setF({ ...f, repeat: true })}>{t('week.repeat')}</Chip>
          <Chip selected={!f.repeat} onClick={() => setF({ ...f, repeat: false })}>{t('week.oneTime')}</Chip>
        </div>
        {f.repeat ? (
          <div className="flex gap-1" role="group">
            {wd.map((d, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={f.days.includes(i)}
                onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i] })}
                className={cn('h-10 w-10 rounded-full border text-sm font-bold', f.days.includes(i) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
              >
                {d}
              </button>
            ))}
          </div>
        ) : (
          <label className="block text-sm font-semibold">
            {t('week.date')}
            <Input type="date" className="mt-1 min-h-[44px] font-normal" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold">
            {t('week.start')}
            <Input type="time" className="mt-1 min-h-[44px] font-normal" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
          </label>
          <label className="text-sm font-semibold">
            {t('week.end')}
            <Input type="time" className="mt-1 min-h-[44px] font-normal" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
          </label>
        </div>
        <Button
          className="w-full"
          loading={busy}
          disabled={!f.title.trim() || (f.repeat && !f.days.length) || f.end <= f.start}
          onClick={async () => {
            setBusy(true);
            try {
              await act('calendarAdd', { volunteer_key: identity, blocks: [{ title: f.title, kind: f.kind, start: f.start, end: f.end, ...(f.repeat ? { days: f.days } : { date: f.date }), source: 'manual' }] });
              onSaved();
              onClose();
            } catch {
              /* toast */
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('week.save')}
        </Button>
      </div>
    </Sheet>
  );
}

function ImportSheet({ open, onClose, onSaved }) {
  const { t, lang } = useI18n();
  const { act, identity, hideHelpers } = useApp();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(null);
  const fileRef = useRef(null);
  const wdNames = [0, 1, 2, 3, 4, 5, 6].map((d) => new Date(Date.UTC(2026, 0, 4 + d, 12)).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'short', timeZone: 'UTC' }));

  const show = (res) => {
    setPreview(res.blocks);
    setPicked(res.blocks.map((_, i) => i));
    setSource(res.source || 'ics');
  };
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setText('');
    }
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title={t('week.importTitle')}>
      {!preview ? (
        <div className="space-y-3">
          <label htmlFor="sched" className="text-sm font-semibold">
            {t('week.typeIt')}
          </label>
          <Textarea id="sched" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('week.typeHint')} maxLength={1200} />
          {!hideHelpers && (
            <button type="button" className="rounded-full border border-dashed border-accent px-2.5 py-1 text-xs font-bold text-accent" onClick={() => setText(t('week.typeHint').replace(/^[^:]+:\s*/, ''))}>
              {t('demo.chip', { code: t('week.typeIt') })}
            </button>
          )}
          <Button
            className="w-full"
            loading={busy}
            disabled={!text.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                show(await act('parseSchedule', { text }));
              } catch {
                /* toast */
              } finally {
                setBusy(false);
              }
            }}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" /> {busy ? t('week.parsing') : t('week.parse')}
          </Button>
          <div className="border-t pt-3">
            <input
              ref={fileRef}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  show(await act('parseCalendarFile', { ics: await file.text() }));
                } catch {
                  /* toast */
                } finally {
                  setBusy(false);
                  e.target.value = '';
                }
              }}
            />
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              <FileUp className="h-4 w-4" aria-hidden="true" /> {t('week.ics')}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">{t('week.icsHint')}</p>
          </div>
        </div>
      ) : !preview.length ? (
        <div className="space-y-3">
          <Alert variant="warning">{t('week.nothingFound')}</Alert>
          <Button variant="outline" onClick={() => setPreview(null)}>{t('common.back')}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {t('week.preview')} {source === 'ai' && <AiTag />}
          </p>
          <div className="grid gap-1.5">
            {preview.map((b, i) => (
              <CheckItem key={i} checked={picked.includes(i)} onChange={(c) => setPicked(c ? [...picked, i] : picked.filter((x) => x !== i))} description={`${b.days ? b.days.map((d) => wdNames[d]).join(', ') : b.date} · ${hhmmLabel(b.start, lang)}–${hhmmLabel(b.end, lang)}`}>
                <span className="font-semibold">{b.title}</span> <span className="text-xs text-muted-foreground">({t(`week.kind.${b.kind}`)})</span>
              </CheckItem>
            ))}
          </div>
          <Button
            className="w-full"
            loading={busy}
            disabled={!picked.length}
            onClick={async () => {
              setBusy(true);
              try {
                await act('calendarAdd', { volunteer_key: identity, blocks: preview.filter((_, i) => picked.includes(i)) });
                onSaved();
                onClose();
              } catch {
                /* toast */
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('week.addSelected', { count: picked.length })}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function BlockSheet({ block, date, onClose, onChanged, codes }) {
  const { t, lang } = useI18n();
  const { act, identity } = useApp();
  const [code, setCode] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!block) return null;
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
      onClose();
    } catch (e) {
      setErr(e?.code === 'wrong_code' ? t('vol.wrongCode') : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };
  const title = block.kind === 'loop' && lang === 'es' && block.title_es ? block.title_es : block.title;
  return (
    <Sheet open onClose={onClose} title={title}>
      <p className="text-sm text-muted-foreground">
        {t(`week.kind.${block.kind}`)} · {hhmmLabel(block.start, lang)}–{hhmmLabel(block.end, lang)}
        {block.place && ` · ${block.place}`}
      </p>
      <div className="mt-4 space-y-2">
        {block.kind === 'loop' && block.status === 'done' && <p className="font-semibold text-success">{t('week.done')}</p>}
        {block.kind === 'loop' && block.opp_type === 'mission' && block.status !== 'done' && (
          <Button as={Link} to={`/missions/${block.ref_key}`} className="w-full">
            {t('week.openMission')}
          </Button>
        )}
        {block.kind === 'loop' && ['project', 'event'].includes(block.opp_type) && block.status !== 'done' && (
          <div className="space-y-2">
            <CodeInput label={t('week.checkinCode')} value={code} onChange={setCode} demoCode={codes?.[block.ref_key]} error={err} />
            <Button
              className="w-full"
              loading={busy}
              disabled={code.length !== 4}
              onClick={() =>
                run(() =>
                  block.opp_type === 'project'
                    ? act('checkinShift', { volunteer_key: identity, block_key: block.key, code }, { silent: true })
                    : act('eventCheckin', { event_key: block.ref_key, volunteer_key: identity, code }, { silent: true }),
                )
              }
            >
              {t('week.checkin')}
            </Button>
          </div>
        )}
        {block.kind === 'loop' && block.status !== 'done' && (
          <Button variant="ghost" className="w-full" onClick={() => run(() => act('calendarRemove', { volunteer_key: identity, block_key: block.key }))}>
            {t('week.cancelCommitment')}
          </Button>
        )}
        {block.kind !== 'loop' && (
          <>
            {block.recurring && (
              <Button variant="outline" className="w-full" onClick={() => run(() => act('calendarRemove', { volunteer_key: identity, block_key: block.key, date }))}>
                {t('week.skipDay')}
              </Button>
            )}
            <Button variant="ghost" className="w-full text-danger" onClick={() => run(() => act('calendarRemove', { volunteer_key: identity, block_key: block.key }))}>
              {block.recurring ? t('week.deleteAll') : t('week.remove')}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function PrefsSheet({ open, onClose, profile, interests, onSaved }) {
  const { t } = useI18n();
  const { act, identity } = useApp();
  const [picked, setPicked] = useState(profile?.interests || []);
  const [goal, setGoal] = useState(profile?.weekly_goal_hours || 2);
  useEffect(() => {
    if (open) {
      setPicked(profile?.interests || []);
      setGoal(profile?.weekly_goal_hours || 2);
    }
  }, [open, profile]);
  return (
    <Sheet open={open} onClose={onClose} title={t('week.prefs')}>
      <p className="text-sm font-semibold">{t('week.interests')}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {interests.map((i) => (
          <Chip key={i} selected={picked.includes(i)} onClick={() => setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i])}>
            {t(`interests.${i}`)}
          </Chip>
        ))}
      </div>
      <p className="mt-4 text-sm font-semibold">{t('week.goalHours')}</p>
      <div className="mt-2 flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setGoal((g) => Math.max(0.5, g - 0.5))} aria-label="−">−</Button>
        <span className="min-w-[3ch] text-center text-2xl font-extrabold">{goal}</span>
        <Button variant="outline" size="icon" onClick={() => setGoal((g) => Math.min(12, g + 0.5))} aria-label="+">+</Button>
      </div>
      <Button
        className="mt-4 w-full"
        onClick={async () => {
          await act('updateProfile', { volunteer_key: identity, interests: picked, weekly_goal_hours: goal }).catch(() => {});
          onSaved();
          onClose();
        }}
      >
        {t('week.save')}
      </Button>
    </Sheet>
  );
}

export default function MyWeek() {
  const { t, lang } = useI18n();
  const { act, identity, toast, live } = useApp();
  const { data, reload, aiLoading } = useCoordinator(identity, lang);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(null);
  const [sheet, setSheet] = useState(null); // 'add' | 'import' | 'prefs' | {block} | {move} | {decline}
  const [alts, setAlts] = useState(null);

  useEffect(() => {
    if (data && !selected) setSelected(data.today);
  }, [data, selected]);

  const codes = useMemo(() => {
    const out = {};
    for (const e of live?.events || []) out[e.key] = e.demo_checkin;
    return { ...out, ...(data?.demo_codes || {}) };
  }, [live, data]);

  if (!data) {
    return (
      <div className="space-y-3 pt-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const day = data.week.find((d) => d.date === selected) || data.week[0];
  const daySuggestions = data.suggestions.filter((s) => s.date === day.date);
  const nowMin = (() => {
    const d = new Date(data.now);
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d);
    return Number(p.find((x) => x.type === 'hour').value) * 60 + Number(p.find((x) => x.type === 'minute').value);
  })();
  const freeH = Math.round(data.stats.free_minutes / 60);
  const plannedH = Math.round((data.stats.committed_minutes / 60) * 10) / 10;
  const goalH = data.profile.weekly_goal_hours;
  const pct = Math.min(100, Math.round((plannedH / goalH) * 100));

  async function accept(s, buddy) {
    setBusy(s.opp_key);
    try {
      await act('acceptSuggestion', { volunteer_key: identity, opp_key: s.opp_key, buddy_key: buddy || undefined });
      toast(t('week.accepted'), 'success');
      await reload();
    } catch {
      /* toast shown */
    } finally {
      setBusy(null);
    }
  }
  async function openMove(s) {
    setSheet({ move: s });
    setAlts(null);
    try {
      setAlts((await act('alternatives', { volunteer_key: identity, opp_key: s.opp_key }, { silent: true })).options);
    } catch {
      setAlts([]);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">{t('week.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('week.subtitle')}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSheet('prefs')} aria-label={t('week.prefs')}>
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <p className="text-[15px] font-medium" aria-live="polite">
            {data.summary ? (lang === 'es' ? data.summary.es : data.summary.en) : t('week.summaryFallback', { free: `${freeH} h`, count: data.suggestions.length })}{' '}
            {data.summary?.ai && <AiTag className="ml-1 align-middle" />}
            {aiLoading && !data.summary && <span className="ml-1 inline-block h-3 w-16 animate-pulse rounded bg-muted align-middle" aria-hidden="true" />}
          </p>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted p-2">
            <dd className="text-lg font-extrabold text-primary">{freeH} h</dd>
            <dt className="text-[11px] text-muted-foreground">{t('week.free')}</dt>
          </div>
          <div className="rounded-xl bg-muted p-2">
            <dd className="text-lg font-extrabold text-primary">{plannedH} h</dd>
            <dt className="text-[11px] text-muted-foreground">{t('week.planned')}</dt>
          </div>
          <div className="rounded-xl bg-muted p-2">
            <dd className="text-lg font-extrabold text-primary">{pct}%</dd>
            <dt className="text-[11px] text-muted-foreground">{t('week.goalOf', { done: plannedH, goal: goalH })}</dt>
          </div>
        </dl>
      </Card>

      <div className="flex gap-2">
        <Button variant="soft" size="sm" onClick={() => setSheet('import')}>
          <Upload className="h-4 w-4" aria-hidden="true" /> {t('week.importTitle')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSheet('add')}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t('week.add')}
        </Button>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label={t('week.title')}>
        {data.week.map((d) => {
          const n = data.suggestions.filter((s) => s.date === d.date).length;
          const committed = d.blocks.some((b) => b.kind === 'loop');
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={d.date === day.date}
              onClick={() => setSelected(d.date)}
              className={cn('flex min-w-[52px] flex-col items-center rounded-2xl border px-2 py-1.5 text-xs font-semibold transition', d.date === day.date ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}
            >
              <span>{d.date === data.today ? t('week.today') : dayLabel(d.date, lang)}</span>
              <span className="text-lg font-extrabold leading-tight">{Number(d.date.slice(8))}</span>
              <span className="flex h-2 gap-0.5" aria-hidden="true">
                {committed && <span className={cn('h-1.5 w-1.5 rounded-full', d.date === day.date ? 'bg-primary-foreground' : 'bg-primary')} />}
                {n > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </span>
            </button>
          );
        })}
      </div>

      <section aria-labelledby="sugg-title">
        <h2 id="sugg-title" className="mb-2 flex items-center gap-2 font-extrabold">
          <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" /> {t('week.suggestions')}
        </h2>
        {daySuggestions.length ? (
          <div className="space-y-3">
            {daySuggestions.map((s) => (
              <SuggestionCard key={s.opp_key} s={s} busy={busy} onAccept={accept} onMove={openMove} onDecline={(x) => setSheet({ decline: x })} />
            ))}
          </div>
        ) : (
          <Card className="p-4 text-sm text-muted-foreground">{t('week.noSuggestions')}</Card>
        )}
      </section>

      <section aria-label={dayLabel(day.date, lang, 'long')}>
        <h2 className="flex items-center gap-2 font-extrabold">
          <Clock className="h-4 w-4 text-primary" aria-hidden="true" /> {dayLabel(day.date, lang, 'long')}
        </h2>
        {!day.blocks.length && <p className="mt-1 text-sm text-muted-foreground">{t('week.empty')}</p>}
        <Timeline day={day} suggestions={daySuggestions} isToday={day.date === data.today} nowMin={nowMin} onBlock={(b) => setSheet({ block: b })} onSuggestion={(s) => document.getElementById(`s-${s.opp_key}`)?.scrollIntoView({ behavior: 'smooth' })} />
      </section>

      <AddBlockSheet open={sheet === 'add'} onClose={() => setSheet(null)} date={day.date} onSaved={reload} />
      <ImportSheet open={sheet === 'import'} onClose={() => setSheet(null)} onSaved={reload} />
      <PrefsSheet open={sheet === 'prefs'} onClose={() => setSheet(null)} profile={data.profile} interests={data.interests} onSaved={reload} />
      {sheet?.block && <BlockSheet block={sheet.block} date={day.date} codes={codes} onClose={() => setSheet(null)} onChanged={reload} />}
      {sheet?.move && (
        <Sheet open onClose={() => setSheet(null)} title={t('week.moveTitle')}>
          {!alts ? (
            <Skeleton className="h-24" />
          ) : !alts.length ? (
            <p className="text-sm text-muted-foreground">{t('week.noAlternatives')}</p>
          ) : (
            <div className="grid gap-2">
              {alts.map((a) => (
                <button
                  key={a.opp_key}
                  type="button"
                  className="flex items-center justify-between rounded-xl border p-3 text-left hover:bg-muted"
                  onClick={async () => {
                    setSheet(null);
                    await accept(a, a.buddies[0]?.key);
                  }}
                >
                  <span className="font-semibold">
                    {dayLabel(a.date, lang, 'long')} · {hhmmLabel(a.start, lang)}–{hhmmLabel(a.end, lang)}
                  </span>
                  <span className="text-xs text-muted-foreground">{t('week.likely', { p: a.likelihood })}</span>
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}
      {sheet?.decline && (
        <Sheet open onClose={() => setSheet(null)} title={t('week.declineTitle')}>
          <div className="grid gap-2">
            {['not_interested', 'busy', 'too_far', 'other'].map((r) => (
              <Button
                key={r}
                variant="outline"
                onClick={async () => {
                  const s = sheet.decline;
                  setSheet(null);
                  await act('declineSuggestion', { volunteer_key: identity, opp_key: s.opp_key, reason: r }).catch(() => {});
                  toast(t('week.declined'));
                  reload();
                }}
              >
                {t(`week.declineReasons.${r}`)}
              </Button>
            ))}
          </div>
        </Sheet>
      )}
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" /> {t('demo.badgeInfo')}
      </p>
    </div>
  );
}
