import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MoreVertical, RotateCcw, Eye, EyeOff, Moon, Sun, Info, ShieldCheck, Phone, Check } from 'lucide-react';
import { Icon } from './icons';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/app';
import { IS_LOCAL } from '@/api/backend';
import { formatTime } from '@shared/time.js';
import { storage } from '@/lib/storage';
import LoopRing from './LoopRing';
import { Toasts } from './bits';
import { cn } from './ui';

const LivePanel = lazy(() => import('./LivePanel'));

export const ROLE_TABS = {
  neighbor: [
    ['/help', 'tabs.getHelp', 'help'],
    ['/plan', 'tabs.myPlan', 'plan'],
    ['/map', 'tabs.map', 'map'],
    ['/impact', 'tabs.impact', 'impact'],
  ],
  give: [
    ['/give', 'tabs.post', 'post'],
    ['/give/posts', 'tabs.myPosts', 'posts'],
    ['/map', 'tabs.map', 'map'],
    ['/impact', 'tabs.impact', 'impact'],
  ],
  volunteer: [
    ['/missions', 'tabs.missions', 'missions'],
    ['/week', 'tabs.myWeek', 'week'],
    ['/map', 'tabs.map', 'map'],
    ['/hours', 'tabs.myHours', 'hours'],
    ['/impact', 'tabs.impact', 'impact'],
  ],
  hub: [
    ['/hub', 'tabs.today', 'today'],
    ['/hub/pulse', 'tabs.pulse', 'pulse'],
    ['/hub/events', 'tabs.events', 'events'],
    ['/impact', 'tabs.impact', 'impact'],
  ],
};

const IDENTITY_OPTIONS = {
  give: [['maple-masa', 'Maple & Masa Bakery'], ['riverbend-taqueria', 'Riverbend Taquería'], ['green-crate', 'Green Crate Market'], ['eastbank-cafeteria', 'Eastbank Middle School cafeteria']],
  volunteer: [['jordan', 'Jordan R. · 16'], ['maya', 'Maya T. · 16'], ['ana', 'Ana P. · 14'], ['sam', 'Sam K. · 18']],
  hub: [['riverside-fridge', 'Riverside Community Fridge'], ['oltorf-pantry', 'Oltorf Pantry Shelf'], ['grove-closet', 'Grove Free Closet & Fridge']],
};

function useOutside(ref, onClose, open) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => !ref.current?.contains(e.target) && onClose();
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [ref, onClose, open]);
}

function RoleSwitcher() {
  const { t } = useI18n();
  const { role, setRole, identities, setIdentity, token } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false), open);

  const choose = (r, identity) => {
    setRole(r);
    if (identity) setIdentity(r, identity);
    setOpen(false);
    // A neighbor with a plan goes straight back to it (where the TONIGHT card lives).
    navigate(r === 'neighbor' && token ? `/p/${token}` : ROLE_TABS[r][0][0]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-primary-soft px-3 text-sm font-semibold text-primary"
      >
        <span className="hidden text-xs font-medium opacity-80 min-[380px]:inline">{t('roles.label')}:</span> {t(`roles.${role}`)}
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute left-1/2 top-12 z-50 w-72 -translate-x-1/2 rounded-[20px] border border-border bg-card p-2 shadow-lift">
          {['neighbor', 'give', 'volunteer', 'hub'].map((r) => (
            <div key={r} className="py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => choose(r)}
                className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-semibold hover:bg-muted', role === r && 'text-primary')}
              >
                {t(`roles.${r}`)}
                {role === r && <Check className="h-4 w-4" aria-hidden="true" />}
              </button>
              {IDENTITY_OPTIONS[r] && (
                <div className="ml-3 flex flex-wrap gap-1 pb-1">
                  {IDENTITY_OPTIONS[r].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={identities[r] === key}
                      onClick={() => choose(r, key)}
                      className={cn('rounded-full border px-2 py-0.5 text-xs', identities[r] === key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DemoMenu() {
  const { t } = useI18n();
  const { resetDemo, hideHelpers, toggleHelpers, role } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false), open);

  const item = 'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-muted';
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={t('demo.menu')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
        <MoreVertical className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-64 rounded-[20px] border border-border bg-card p-2 shadow-lift">
          <p className="px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('demo.menu')}</p>
          <button
            type="button"
            role="menuitem"
            className={item}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await resetDemo();
                navigate(ROLE_TABS[role][0][0]);
              } finally {
                setBusy(false);
                setOpen(false);
              }
            }}
          >
            <RotateCcw className={cn('h-4 w-4', busy && 'animate-spin')} aria-hidden="true" /> {busy ? t('demo.resetting') : t('demo.reset')}
          </button>
          <button type="button" role="menuitemcheckbox" aria-checked={hideHelpers} className={item} onClick={toggleHelpers}>
            {hideHelpers ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />} {hideHelpers ? t('demo.showHelpers') : t('demo.hideHelpers')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              const next = !dark;
              document.documentElement.classList.toggle('dark', next);
              storage.set('loop.theme', next ? 'dark' : 'light');
              setDark(next);
            }}
          >
            {dark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />} {dark ? t('nav.themeLight') : t('nav.themeDark')}
          </button>
          <div className="my-1 border-t" />
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); navigate('/about'); }}>
            <Info className="h-4 w-4" aria-hidden="true" /> {t('nav.about')}
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); navigate('/trust'); }}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t('nav.trust')}
          </button>
        </div>
      )}
    </div>
  );
}

function LanguageButton() {
  const { t, lang, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
      aria-label={t('nav.switchToLabel')}
      lang={lang === 'en' ? 'es' : 'en'}
      className="relative h-10 w-12 [perspective:300px]"
    >
      {/* A little two-sided card that flips over when the language changes */}
      <motion.span
        key={lang}
        initial={{ rotateY: -180 }}
        animate={{ rotateY: 0 }}
        transition={{ duration: 0.3, ease: [0.3, 0.7, 0.4, 1] }}
        className="absolute inset-1 flex items-center justify-center rounded-[10px] border-2 border-border bg-card text-sm font-extrabold [backface-visibility:hidden]"
      >
        {lang === 'en' ? 'ES' : 'EN'}
      </motion.span>
    </button>
  );
}

export function DemoBadge({ className }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent-deep">
        <Info className="h-3 w-3" aria-hidden="true" /> {t('demo.badge')}
      </button>
      {open && <p className="absolute left-0 top-7 z-40 w-64 rounded-[14px] bg-foreground p-3 text-xs font-medium text-background shadow-lift">{t('demo.badgeInfo')}</p>}
    </div>
  );
}

export function CrisisFooter() {
  const { t } = useI18n();
  const parts = t('crisis.footer').split(/(\{911\}|\{988\}|\{211\})/);
  return (
    <p className="mt-8 flex items-start gap-2 border-t px-1 pt-4 text-xs text-muted-foreground">
      <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
      <span>
        {parts.map((p, i) => {
          const m = p.match(/^\{(\d+)\}$/);
          if (!m) return <span key={i}>{p}</span>;
          return (
            <a key={i} href={`tel:${m[1]}`} className="font-bold text-foreground underline underline-offset-2">
              {m[1] === '211' ? '2-1-1' : m[1]}
            </a>
          );
        })}
      </span>
    </p>
  );
}

function BottomTabs() {
  const { t } = useI18n();
  const { role, token } = useApp();
  const { pathname } = useLocation();
  const tabs = ROLE_TABS[role];
  const isActive = (to) => (to === '/plan' ? pathname.startsWith('/p/') || pathname === '/plan' : to === '/give' || to === '/hub' ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));
  return (
    <nav aria-label="Tabs" className="no-print sticky bottom-0 z-30 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1">
      <div className={cn('grid rounded-[26px] border border-border bg-card p-1 shadow-lift', tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4')}>
        {tabs.map(([to, label, icon]) => {
          const active = isActive(to);
          return (
            <NavLink key={to} to={to === '/plan' && token ? `/p/${token}` : to} className={cn('relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 text-[11px] font-bold', active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {active && <motion.span layoutId="tab-pill" className="absolute inset-0.5 rounded-[22px] bg-primary" transition={{ type: 'spring', stiffness: 520, damping: 34 }} aria-hidden="true" />}
              <motion.span className="relative" animate={active ? { y: [0, -4, 0] } : { y: 0 }} transition={{ duration: 0.28 }}>
                <Icon name={icon} tone={active ? 'sun' : 'paper'} className="h-6 w-6" />
              </motion.span>
              <span className="relative">{t(label)}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function TopBar() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { role } = useApp();
  return (
    <header className="no-print sticky top-0 z-30 border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between gap-1 px-2">
        <button type="button" onClick={() => navigate(ROLE_TABS[role][0][0])} className="flex items-center gap-1.5 rounded-lg px-1 font-display text-lg font-extrabold tracking-tight" aria-label={`${t('app.name')} — home`}>
          <motion.span whileTap={{ rotate: 180 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="inline-flex"><LoopRing size={30} /></motion.span>
          <span className="hidden min-[360px]:inline">{t('app.name')}</span>
        </button>
        <RoleSwitcher />
        <div className="flex items-center">
          <LanguageButton />
          <DemoMenu />
        </div>
      </div>
    </header>
  );
}

function DemoClockLine() {
  const { t, lang } = useI18n();
  const { live } = useApp();
  return (
    <div className="no-print flex items-center justify-between gap-2 px-3 py-1.5">
      <DemoBadge />
      <span className="text-xs font-medium text-muted-foreground">{live ? t('demo.clock', { time: formatTime(live.clock.now, lang) }) : ''}</span>
    </div>
  );
}

export default function Shell() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const scroller = useRef(null);
  useEffect(() => {
    scroller.current?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="relative min-h-screen lg:flex lg:h-screen lg:items-stretch lg:gap-6 lg:overflow-clip lg:bg-paper-2 lg:p-5">
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[70] rounded-lg bg-primary px-4 py-2 text-primary-foreground">
        {t('app.skip')}
      </a>
      <Toasts />
      {/* Phone frame (desktop) / full screen (mobile) */}
      <div className="print-plain relative mx-auto flex min-h-screen w-full flex-col bg-background lg:mx-0 lg:h-full lg:min-h-0 lg:w-[420px] lg:shrink-0 lg:overflow-clip lg:rounded-[44px] lg:border-[10px] lg:border-ink lg:shadow-lift">
        <TopBar />
        <div ref={scroller} className="flex-1 lg:overflow-y-auto lg:scroll-thin">
          <DemoClockLine />
          {IS_LOCAL && <p className="no-print mx-3 mb-1 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">{t('demo.localMode')}</p>}
          <main id="main" tabIndex={-1} className="px-4 pb-6 focus:outline-none">
            {/* Pages load lazily; suspend only this area so the shell and live map stay mounted. */}
            <Suspense fallback={<div className="mt-4 space-y-3"><div className="skeleton h-8 w-2/3" /><div className="skeleton h-40 rounded-[22px]" /></div>}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </Suspense>
            <CrisisFooter />
          </main>
        </div>
        <BottomTabs />
      </div>
      {/* Live Loop panel (desktop only; on mobile it is the Map tab) */}
      <aside className="no-print hidden min-w-0 flex-1 lg:flex" aria-label={t('map.title')}>
        <Suspense fallback={<div className="skeleton h-full w-full rounded-2xl" />}>
          <LivePanel />
        </Suspense>
      </aside>
    </div>
  );
}

