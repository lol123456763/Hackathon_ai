import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Database, MessageSquareWarning, LogOut, Search, Plus, Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { useI18n, formatDate } from '@/i18n';
import { api } from '@/api/backend';
import { CATEGORIES } from '@/lib/categories';
import { toCsv, parseCsv, RESOURCE_CSV_COLUMNS, rowToResource } from '@/lib/csv';
import { Alert, Badge, Button, Card, Chip, Input, Spinner, Textarea, cn } from '@/components/ui';

const STALE_DAYS = 180;
function isStale(r) {
  if (!r.verified_date) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  return r.verified_date < cutoff.toISOString().slice(0, 10);
}

function Bars({ data, labelFor }) {
  const { t } = useI18n();
  if (!data?.length) return <p className="text-sm text-muted-foreground">{t('admin.empty')}</p>;
  const max = Math.max(...data.map((d) => d.count));
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.key || d.day}>
          <div className="flex justify-between text-sm">
            <span>{labelFor ? labelFor(d.key || d.day) : d.key || d.day}</span>
            <span className="font-semibold tabular-nums">{d.count}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Overview() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState(null);
  useEffect(() => {
    api.adminStats().then(setStats).catch(() => setError(true));
  }, []);
  if (error) return <Alert variant="danger">{t('common.error')}</Alert>;
  if (!stats) return <Spinner label={t('common.loading')} />;
  const tiles = [
    [t('admin.plans'), stats.totals.plans],
    [t('admin.aiPlans'), stats.totals.ai_plans],
    [t('admin.feedbackCount'), stats.totals.feedback],
    [t('admin.resourcesCount'), stats.totals.active_resources],
    [t('admin.stale'), stats.totals.stale_resources],
  ];
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map(([label, value]) => (
          <Card key={label} className="p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-display text-3xl font-bold">{value}</dd>
          </Card>
        ))}
      </dl>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">{t('admin.perDay')}</h3>
          <Bars data={stats.plans_per_day} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">{t('admin.topNeeds')}</h3>
          <Bars data={stats.top_needs} labelFor={(k) => t(`categories.${k}`)} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">{t('admin.topCounties')}</h3>
          <Bars data={stats.top_counties} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">{t('admin.topZips')}</h3>
          <Bars data={stats.top_zips} />
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={async () => {
            const r = await api.adminCleanup().catch(() => null);
            setCleanupMsg(r ? t('admin.cleanupDone', { count: r.deleted }) : t('common.error'));
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('admin.cleanup')}
        </Button>
        {cleanupMsg && <span role="status">{cleanupMsg}</span>}
      </div>
    </div>
  );
}

function FeedbackTab() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.adminStats().then(setStats).catch(() => setStats({ ratings: {}, flagged_resources: [] }));
  }, []);
  if (!stats) return <Spinner label={t('common.loading')} />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-3 font-semibold">{t('admin.ratings')}</h3>
        <Bars data={Object.entries(stats.ratings || {}).map(([key, count]) => ({ key, count }))} />
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 font-semibold">{t('admin.flagged')}</h3>
        {stats.flagged_resources?.length ? (
          <ul className="divide-y">
            {stats.flagged_resources.map((f) => (
              <li key={f.slug} className="flex justify-between py-2 text-sm">
                <code>{f.slug}</code>
                <span>
                  wrong info: {f.wrong_info} · not helpful: {f.not_helpful}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('admin.empty')}</p>
        )}
      </Card>
    </div>
  );
}

const EMPTY_RESOURCE = {
  slug: '', name: '', organization: '', categories: [], description_en: '', description_es: '', eligibility_summary_en: '', eligibility_summary_es: '',
  how_to_apply_en: '', how_to_apply_es: '', documents_needed: [], apply_url: '', phone: '', address: '', city: '', zip: '', hours: '',
  walk_in: false, apply_online: false, coverage_type: 'county', coverage_counties: [], source_url: '', confidence: 'medium', is_active: true, verified_date: '', priority_weight: 0, notes: '',
};

function ResourceEditor({ initial, onSave, onCancel }) {
  const { t } = useI18n();
  const [r, setR] = useState({ ...EMPTY_RESOURCE, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setR((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const list = (k) => (e) => setR((x) => ({ ...x, [k]: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) }));

  async function submit(e) {
    e.preventDefault();
    if (!r.name.trim() || !r.categories.length) {
      setError(t('admin.fieldRequired'));
      return;
    }
    const slug = r.slug || r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    setSaving(true);
    try {
      await onSave({ ...r, slug, priority_weight: Number(r.priority_weight) || 0 });
    } catch {
      setError(t('common.error'));
      setSaving(false);
    }
  }

  const text = (k, label, props = {}) => (
    <label className="block text-sm font-semibold">
      {label}
      <Input className="mt-1 font-normal" value={r[k] ?? ''} onChange={set(k)} {...props} />
    </label>
  );
  const area = (k, label) => (
    <label className="block text-sm font-semibold">
      {label}
      <Textarea rows={3} className="mt-1 font-normal" value={r[k] ?? ''} onChange={set(k)} />
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {text('name', `${t('admin.columns.name')} *`, { required: true })}
        {text('organization', 'Organization')}
        {text('slug', 'Slug (id)', { placeholder: 'auto from name', disabled: !!initial?.entity_id || !!initial?.slug })}
        {text('verified_date', t('admin.columns.verified'), { type: 'date' })}
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">{t('admin.columns.categories')} *</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c} selected={r.categories.includes(c)} onClick={() => setR((x) => ({ ...x, categories: x.categories.includes(c) ? x.categories.filter((y) => y !== c) : [...x.categories, c] }))}>
              {t(`categories.${c}`)}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        {area('description_en', 'Description (EN)')}
        {area('description_es', 'Descripción (ES)')}
        {area('eligibility_summary_en', "Who it's for (EN)")}
        {area('eligibility_summary_es', 'Para quién es (ES)')}
        {area('how_to_apply_en', 'How to apply (EN)')}
        {area('how_to_apply_es', 'Cómo solicitar (ES)')}
      </div>
      <label className="block text-sm font-semibold">
        Documents needed (one per line)
        <Textarea rows={3} className="mt-1 font-normal" value={(r.documents_needed || []).join('\n')} onChange={list('documents_needed')} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        {text('phone', 'Phone')}
        {text('apply_url', 'Website', { type: 'url' })}
        {text('source_url', 'Source URL', { type: 'url' })}
        {text('address', 'Address')}
        {text('city', 'City')}
        {text('zip', 'ZIP', { inputMode: 'numeric', maxLength: 5 })}
        {text('hours', t('resource.hours'))}
        <label className="block text-sm font-semibold">
          {t('admin.columns.coverage')}
          <select className="mt-1 min-h-[48px] w-full rounded-xl border border-input bg-card px-3 font-normal" value={r.coverage_type} onChange={set('coverage_type')}>
            {['national', 'state', 'region', 'county', 'city'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Counties (one per line)
          <Textarea rows={2} className="mt-1 font-normal" value={(r.coverage_counties || []).join('\n')} onChange={list('coverage_counties')} />
        </label>
      </div>
      <div className="flex flex-wrap gap-4">
        {[
          ['walk_in', t('resource.walkIn')],
          ['apply_online', t('resource.online')],
          ['is_active', t('admin.active')],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={!!r[k]} onChange={set(k)} /> {label}
          </label>
        ))}
        <label className="flex items-center gap-2">
          Priority
          <Input type="number" min={-3} max={3} className="w-20" value={r.priority_weight} onChange={set('priority_weight')} />
        </label>
      </div>
      {area('notes', 'Internal notes')}
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          {t('admin.save')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('admin.cancel')}
        </Button>
      </div>
    </form>
  );
}

function ResourcesAdmin() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [onlyStale, setOnlyStale] = useState(false);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  const load = () => api.adminListResources().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => (!s || `${r.name} ${r.organization || ''} ${r.slug} ${(r.coverage_counties || []).join(' ')}`.toLowerCase().includes(s)) && (!onlyStale || isStale(r)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, q, onlyStale]);

  async function save(r) {
    await api.adminSaveResource(r);
    setEditing(null);
    setMsg(t('admin.saved'));
    load();
  }

  function exportCsv() {
    const blob = new Blob([toCsv(rows || [], RESOURCE_CSV_COLUMNS)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `benefitbridge-resources-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importCsv(file) {
    const text = await file.text();
    const parsed = parseCsv(text).map(rowToResource).filter((r) => r.slug && r.name);
    const bySlug = new Map((rows || []).map((r) => [r.slug, r]));
    for (const r of parsed) {
      const existing = bySlug.get(r.slug);
      await api.adminSaveResource(existing ? { ...existing, ...r } : r);
    }
    setMsg(t('admin.importDone', { count: parsed.length }));
    load();
  }

  if (editing) {
    return (
      <Card className="p-5">
        <ResourceEditor initial={editing === 'new' ? {} : editing} onSave={save} onCancel={() => setEditing(null)} />
      </Card>
    );
  }
  if (!rows) return <Spinner label={t('common.loading')} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="admin-search" className="sr-only">
            {t('admin.search')}
          </label>
          <Input id="admin-search" className="pl-9" placeholder={t('admin.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Chip selected={onlyStale} onClick={() => setOnlyStale((s) => !s)}>
          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {t('admin.needsReverify')}
        </Chip>
        <Button onClick={() => setEditing('new')} size="sm">
          <Plus className="h-4 w-4" aria-hidden="true" /> {t('admin.add')}
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" aria-hidden="true" /> {t('admin.exportCsv')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" /> {t('admin.importCsv')}
        </Button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
      </div>
      {msg && (
        <Alert variant="success" role="status">
          {msg}
        </Alert>
      )}
      <p className="text-sm text-muted-foreground">{t('filters.showing', { count: filtered.length })}</p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/60">
            <tr>
              {['name', 'categories', 'coverage', 'verified', 'status'].map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-semibold">
                  {t(`admin.columns.${c}`)}
                </th>
              ))}
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">{t('admin.edit')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.slice(0, 500).map((r) => (
              <tr key={r.slug} className={cn(r.is_active === false && 'opacity-60')}>
                <td className="px-3 py-2">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.slug}</p>
                </td>
                <td className="px-3 py-2">{(r.categories || []).map((c) => t(`categories.${c}`)).join(', ')}</td>
                <td className="px-3 py-2">
                  {r.coverage_type}
                  {r.coverage_counties?.length ? `: ${r.coverage_counties.slice(0, 3).join(', ')}${r.coverage_counties.length > 3 ? '…' : ''}` : ''}
                </td>
                <td className="px-3 py-2">
                  {r.verified_date ? formatDate(r.verified_date, lang) : '—'}
                  {isStale(r) && (
                    <Badge variant="accent" className="ml-1">
                      {t('admin.needsReverify')}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => save({ ...r, is_active: r.is_active === false })}
                    aria-label={`${r.is_active === false ? t('admin.activate') : t('admin.deactivate')}: ${r.name}`}
                  >
                    {r.is_active === false ? t('admin.inactive') : t('admin.active')}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(r)} aria-label={`${t('admin.edit')}: ${r.name}`}>
                    {t('admin.edit')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 500 && <p className="text-sm text-muted-foreground">Showing the first 500. Use search to narrow down.</p>}
    </div>
  );
}

export default function Admin() {
  const { t } = useI18n();
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <div className="container-page py-12"><Spinner label={t('common.loading')} /></div>;

  if (!user || user.role !== 'admin') {
    return (
      <div className="container-page max-w-md py-16">
        <Card className="p-6 text-center">
          <h1 className="font-display text-2xl font-bold">{t('admin.signInTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{user ? t('admin.notAdmin') : t('admin.signInBody')}</p>
          {!user ? (
            <div className="mt-6 grid gap-2">
              <Button onClick={() => api.login('google')}>{t('admin.signInGoogle')}</Button>
              <Button variant="outline" onClick={() => api.login()}>
                {t('admin.signInOther')}
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="mt-6" onClick={() => api.logout()}>
              {t('admin.signOut')}
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const TABS = [
    ['overview', BarChart3, t('admin.tabs.overview')],
    ['resources', Database, t('admin.tabs.resources')],
    ['feedback', MessageSquareWarning, t('admin.tabs.feedback')],
  ];

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t('admin.title')}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{user.email}</span>
          {!user.local && (
            <Button variant="ghost" size="sm" onClick={() => api.logout()}>
              <LogOut className="h-4 w-4" aria-hidden="true" /> {t('admin.signOut')}
            </Button>
          )}
        </div>
      </div>
      {user.local && (
        <Alert variant="warning" className="mt-4">
          {t('admin.localMode')}
        </Alert>
      )}
      <div role="tablist" className="mt-6 flex gap-1 border-b">
        {TABS.map(([id, Icon, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('inline-flex min-h-[44px] items-center gap-2 border-b-2 px-3 text-sm font-semibold', tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === 'overview' && <Overview />}
        {tab === 'resources' && <ResourcesAdmin />}
        {tab === 'feedback' && <FeedbackTab />}
      </div>
    </div>
  );
}
