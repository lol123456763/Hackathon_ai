import { useRef, useState } from 'react';
import { Camera, Upload, Image as ImageIcon, Plus, Trash2, AlertTriangle, Tag, Info, ExternalLink } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Loopy } from '@/components/decor';
import { useApp } from '@/state/app';
import { fileToJpegDataUrl, urlToPngDataUrl } from '@/lib/image';
import { hhmmLabel } from '@/lib/format';
import { ITEM_CATEGORIES, STORAGE_TYPES } from '@shared/constants.js';
import { AiTag } from '@/components/bits';
import { Alert, Button, Card, CheckItem, Input, Skeleton, cn } from '@/components/ui';

const GOOD_SAMARITAN_URL = 'https://www.law.cornell.edu/uscode/text/42/1791';
const GIVE_STEPS = ['posted', 'matched', 'picked_up', 'delivered'];

function GiveTracker({ status }) {
  const { t } = useI18n();
  const idx = GIVE_STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-1 text-center text-[11px] font-semibold">
      {GIVE_STEPS.map((s, i) => (
        <li key={s} className={cn('rounded-full px-1 py-1.5', i <= idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')} aria-current={i === idx ? 'step' : undefined}>
          {t(`give.status.${s}`)}
        </li>
      ))}
    </ol>
  );
}

export function LabelPreview({ en, es }) {
  return (
    <div className="tag-hole grid gap-2 rounded-[6px_18px_18px_6px] border-2 border-dashed border-ink/40 bg-white p-3 pl-10 font-mono text-[13px] text-black">
      <p>
        <strong>EN</strong> · {en}
      </p>
      <p>
        <strong>ES</strong> · {es}
      </p>
      <p className="text-[11px]">Loop · {new Date().toLocaleDateString()}</p>
    </div>
  );
}

export default function PostSurplus() {
  const { t, lang } = useI18n();
  const { act, identity, live, toast, errorMessage } = useApp();
  const [stage, setStage] = useState('start');
  const [draft, setDraft] = useState(null);
  const [aiSource, setAiSource] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [blocked, setBlocked] = useState(null);
  const [posted, setPosted] = useState(null);
  const [showLabel, setShowLabel] = useState(false);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);
  const giver = live?.givers.find((g) => g.key === identity);

  async function analyze({ file, sample }) {
    setStage('analyzing');
    setBlocked(null);
    setConfirmed(false);
    try {
      const image = sample ? await urlToPngDataUrl('/sample-surplus.svg').catch(() => null) : await fileToJpegDataUrl(file);
      setPhoto(sample ? '/sample-surplus.svg' : image);
      const res = await act('analyzePhoto', { giver_key: identity, image, sample: !!sample });
      const d = res.draft || { items: [{ name_en: '', name_es: '', quantity_text: '', est_lbs: 0, category: 'other', storage: 'shelf_stable' }], possible_allergens: [], handling_en: '', handling_es: '', label_en: '', label_es: '', safety_flags: [], pickup_start: '17:00', pickup_end: '18:00' };
      setDraft({ ...d, photo_kind: sample ? 'sample' : 'upload' });
      setAiSource(res.source === 'ai' ? 'ai' : res.draft ? 'sample' : 'empty');
      setBlocked(d.safety_flags?.length ? d.safety_flags : null);
      setStage('draft');
    } catch {
      setStage('start');
    }
  }

  const setItem = (i, patch) => setDraft((d) => ({ ...d, items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const total = draft ? Math.round(draft.items.reduce((s, i) => s + (Number(i.est_lbs) || 0), 0) * 10) / 10 : 0;

  async function post() {
    if (!confirmed) return;
    setBusy(true);
    try {
      const res = await act('postDonation', { giver_key: identity, draft: { ...draft, total_lbs: total }, allergens_confirmed: true }, { silent: true });
      setPosted(res);
      setStage('posted');
    } catch (e) {
      if (e?.code === 'unsafe_food') setBlocked(e.extra?.flags || ['unsafe']);
      else toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  }

  const liveDonation = posted && live?.donations.find((d) => d.key === posted.key);

  return (
    <div className="space-y-5 pt-2">
      <div>
        <p className="text-sm font-semibold text-primary">{t('give.actingAs', { name: giver?.name || '' })}</p>
        <h1 className="mt-1 text-2xl font-extrabold">{t('give.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('give.subtitle')}</p>
      </div>

      {stage === 'start' && (
        <Card className="grid gap-2 p-4">
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && analyze({ file: e.target.files[0] })} />
          <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && analyze({ file: e.target.files[0] })} />
          <Button variant="accent" size="lg" onClick={() => analyze({ sample: true })}>
            <ImageIcon className="h-5 w-5" aria-hidden="true" /> {t('give.sample')}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => cameraRef.current?.click()}>
              <Camera className="h-5 w-5" aria-hidden="true" /> {t('give.takePhoto')}
            </Button>
            <Button variant="outline" onClick={() => uploadRef.current?.click()}>
              <Upload className="h-5 w-5" aria-hidden="true" /> {t('give.upload')}
            </Button>
          </div>
        </Card>
      )}

      {stage === 'analyzing' && (
        <Card className="p-4" aria-busy="true">
          <p className="font-semibold" role="status">{t('give.analyzing')}</p>
          <Skeleton className="mt-3 h-40" />
          <Skeleton className="mt-3 h-6 w-2/3" />
        </Card>
      )}

      {stage === 'draft' && draft && (
        <Card className="space-y-4 p-4">
          {photo && <img src={photo} alt="" className="tilt-1 h-40 w-full rounded-[6px] border-[6px] border-card object-cover shadow-soft" />}
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold">{t('give.draftTitle')}</h2>
            {aiSource === 'ai' && <AiTag />}
          </div>
          <p className="text-sm text-muted-foreground">{aiSource === 'empty' ? t('give.emptyDraft') : t('give.draftHint')}</p>

          {blocked && (
            <Alert variant="danger" title={t('give.unsafeTitle')}>
              {t('give.unsafeBody', { reasons: blocked.map((f) => (t(`give.flags.${f}`) === `give.flags.${f}` ? f : t(`give.flags.${f}`))).join(', ') })}
            </Alert>
          )}

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold">{t('give.items')}</legend>
            {draft.items.map((it, i) => (
              <div key={i} className={cn('tag-hole rounded-[6px_20px_20px_6px] border border-border bg-paper-2/60 p-3 pl-10', ['tilt-3', '', 'tilt-2'][i % 3])}>
                <div className="flex gap-2">
                  <Input aria-label={t('give.itemName')} value={lang === 'es' ? it.name_es : it.name_en} onChange={(e) => setItem(i, lang === 'es' ? { name_es: e.target.value } : { name_en: e.target.value, ...(it.name_es ? {} : { name_es: e.target.value }) })} className="min-h-[44px]" />
                  <Button variant="ghost" size="icon" aria-label={t('give.remove')} onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))} disabled={draft.items.length === 1}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_88px] gap-2">
                  <Input aria-label={t('give.qty')} value={it.quantity_text} onChange={(e) => setItem(i, { quantity_text: e.target.value })} className="min-h-[40px] px-3 text-sm" />
                  <label className="relative">
                    <Input type="number" min={0} step={0.5} aria-label={t('give.lbs')} value={it.est_lbs} onChange={(e) => setItem(i, { est_lbs: Number(e.target.value) })} className="min-h-[40px] px-3 pr-9 text-sm" />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">lbs</span>
                  </label>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select aria-label="storage" value={it.storage} onChange={(e) => setItem(i, { storage: e.target.value })} className="min-h-[40px] w-full rounded-[12px] border-2 border-input bg-card px-2 text-xs font-semibold">
                    {STORAGE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {t(`give.storage.${s}`)}
                      </option>
                    ))}
                  </select>
                <select aria-label="category" value={it.category} onChange={(e) => setItem(i, { category: e.target.value })} className="min-h-[40px] w-full rounded-[12px] border-2 border-input bg-card px-2 text-xs font-semibold">
                  {ITEM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`give.category.${c}`)}
                    </option>
                  ))}
                </select>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, items: [...d.items, { name_en: '', name_es: '', quantity_text: '', est_lbs: 0, category: 'other', storage: 'shelf_stable' }] }))}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('give.addItem')}
            </Button>
            <p className="font-bold text-primary">{t('give.total', { lbs: total })}</p>
          </fieldset>

          <div>
            <p className="text-sm font-bold">{t('give.allergens')}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(draft.possible_allergens || []).map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold">
                  <AlertTriangle className="h-3 w-3 text-accent" aria-hidden="true" /> {a}
                  <button type="button" aria-label={`${t('give.remove')} ${a}`} className="ml-0.5 font-bold" onClick={() => setDraft((d) => ({ ...d, possible_allergens: d.possible_allergens.filter((x) => x !== a) }))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <CheckItem className="mt-2" checked={confirmed} onChange={setConfirmed}>
              {t('give.allergensConfirm')}
            </CheckItem>
          </div>

          <div>
            <p className="text-sm font-bold">{t('give.handling')}</p>
            <p className="text-sm">{lang === 'es' ? draft.handling_es || draft.handling_en : draft.handling_en}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-bold">
              {t('give.from')}
              <Input type="time" value={draft.pickup_start} onChange={(e) => setDraft((d) => ({ ...d, pickup_start: e.target.value }))} className="mt-1 min-h-[44px]" />
            </label>
            <label className="text-sm font-bold">
              {t('give.to')}
              <Input type="time" value={draft.pickup_end} onChange={(e) => setDraft((d) => ({ ...d, pickup_end: e.target.value }))} className="mt-1 min-h-[44px]" />
            </label>
          </div>

          {(draft.label_en || draft.label_es) && (
            <div>
              <p className="flex items-center gap-1 text-sm font-bold">
                <Tag className="h-4 w-4" aria-hidden="true" /> {t('give.label')}
              </p>
              <div className="mt-1.5">
                <LabelPreview en={draft.label_en} es={draft.label_es} />
              </div>
            </div>
          )}

          {!confirmed && <p className="text-sm text-muted-foreground">{t('give.confirmAllergens')}</p>}
          <Button variant="accent" size="lg" className="w-full" onClick={post} loading={busy} disabled={!confirmed || !!blocked || !draft.items.some((i) => i.name_en)}>
            {busy ? t('give.posting') : t('give.post')}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setStage('start')}>
            {t('common.cancel')}
          </Button>
        </Card>
      )}

      {stage === 'posted' && posted && (
        <Card className="space-y-4 p-4 text-center">
          <Loopy mood="carry" size={80} className="mx-auto" />
          <h2 className="text-lg font-extrabold">{t('give.postedTitle')}</h2>
          <p className="text-sm font-semibold text-muted-foreground">{t('give.code')}</p>
          <p className="mx-auto w-fit -rotate-2 rounded-[14px] bg-[#FFE7A8] px-4 py-1 font-mono text-6xl font-extrabold tracking-[0.2em] text-ink" aria-live="polite">
            {posted.pickup_code}
          </p>
          {liveDonation && (
            <div className="text-left">
              <GiveTracker status={liveDonation.status} />
              {liveDonation.volunteers?.length > 0 && (
                <p className="mt-2 text-sm">{t('give.carriedBy', { names: liveDonation.volunteers.map((v) => v.name).join(' & '), team: liveDonation.volunteers[0].team })}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {t('give.window')}: {hhmmLabel(liveDonation.pickup_start, lang)}–{hhmmLabel(liveDonation.pickup_end, lang)}
              </p>
            </div>
          )}
          <Button variant="outline" onClick={() => setShowLabel((s) => !s)}>
            <Tag className="h-4 w-4" aria-hidden="true" /> {showLabel ? t('give.hideLabel') : t('give.showLabel')}
          </Button>
          {showLabel && <LabelPreview en={draft.label_en} es={draft.label_es} />}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStage('start');
              setPosted(null);
              setDraft(null);
            }}
          >
            {t('give.another')}
          </Button>
        </Card>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {t('give.goodSamaritan')}{' '}
          <a href={GOOD_SAMARITAN_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold underline">
            {t('give.learnMore')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </span>
      </p>
    </div>
  );
}
