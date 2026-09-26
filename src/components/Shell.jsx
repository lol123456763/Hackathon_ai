// The app frame. Computer: a website with the role's pages in the header and the Live Loop panel in a
// sticky side column. Phone: the same pages with a thumb-friendly tab bar at the bottom.
// Visual language comes from BenefitBridge (see docs/DESIGN.md).
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronDown, HeartHandshake, Map as MapIcon, BarChart3, ClipboardList, Camera, Package, Footprints, Clock, Store, Activity, CalendarDays, CalendarClock, MoreVertical, RotateCcw, Eye, EyeOff, Moon, Sun, Info, ShieldCheck, Check,
} from 'lucide-react';
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
    ['/help', 'tabs.getHelp', HeartHandshake],
    ['/plan', 'tabs.myPlan', ClipboardList],
    ['/map', 'tabs.map', MapIcon],
    ['/impact', 'tabs.impact', BarChart3],
  ],
  give: [
    ['/give', 'tabs.post', Camera],
    ['/give/posts', 'tabs.myPosts', Package],
    ['/map', 'tabs.map', MapIcon],
    ['/impact', 'tabs.impact', BarChart3],
  ],
  volunteer: [
    ['/missions', 'tabs.missions', Footprints],
    ['/week', 'tabs.myWeek', CalendarClock],
    ['/map', 'tabs.map', MapIcon],
    ['/hours', 'tabs.myHours', Clock],
    ['/impact', 'tabs.impact', BarChart3],
  ],
  hub: [
    ['/hub', 'tabs.today', Store],
    ['/hub/pulse', 'tabs.pulse', Activity],
    ['/hub/events', 'tabs.events', CalendarDays],
    ['/impact', 'tabs.impact', BarChart3],
  ],
};

// Pages that lay out their own wide view on a computer (no side panel).
const FULL_WIDTH = ['/help', '/map'];

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

function useActive() {
  const { pathname } = useLocation();
  return (to) => (to === '/plan' ? pathname.startsWith('/p/') || pathname === '/plan' : to === '/give' || to === '/hub' ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));
}

const MENU = 'absolute z-50 cut-2 border-2 border-border bg-card p-2 shadow-lift';

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
        className="cut-chip inline-flex min-h-[42px] items-center gap-1 bg-tile-4 px-3 text-sm font-bold text-primary shadow-[3px_4px_0_rgba(25,62,55,0.12)]"
      >
        <span className="hidden text-xs font-semibold opacity-75 min-[400px]:inline">{t('roles.label')}:</span> {t(`roles.${role}`)}
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className={cn(MENU, 'left-1/2 top-12 w-72 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0')}>
          {['neighbor', 'give', 'volunteer', 'hub'].map((r) => (
            <div key={r} className="py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => choose(r)}
                className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2 text-left font-bold hover:bg-muted', role === r && 'text-teal')}
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
                      className={cn('cut-chip border px-2 py-0.5 text-xs', identities[r] === key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
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

  const item = 'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted';
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={t('demo.menu')} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted">
        <MoreVertical className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className={cn(MENU, 'right-0 top-12 w-64')}>
          <p className="px-3 pb-1 pt-1 text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{t('demo.menu')}</p>
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
          <div className="my-1 border-t-2 border-dashed" />
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
      className="min-h-[42px] border-2 border-[#aac5b9] px-3 text-sm font-bold text-primary transition-colors hover:bg-primary-soft sm:px-4"
      style={{ borderRadius: '30px 22px 26px 19px / 24px 30px 20px 26px' }}
    >
      <span className="sm:hidden">{lang === 'en' ? 'ES' : 'EN'}</span>
      <span className="hidden sm:inline">{lang === 'en' ? 'Español' : 'English'}</span>
    </button>
  );
}

export function DemoBadge({ className }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="cut-chip inline-flex items-center gap-1 bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent">
        <Info className="h-3 w-3" aria-hidden="true" /> {t('demo.badge')}
      </button>
      {open && <p className="cut-2 absolute left-0 top-7 z-40 w-64 bg-primary p-3 text-xs font-medium text-primary-foreground shadow-lift">{t('demo.badgeInfo')}</p>}
    </div>
  );
}

export function CrisisFooter({ className }) {
  const { t } = useI18n();
  const parts = t('crisis.footer').split(/(\{911\}|\{988\}|\{211\})/);
  return (
    <p className={cn('text-sm', className)}>
      {parts.map((p, i) => {
        const m = p.match(/^\{(\d+)\}$/);
        if (!m) return <span key={i}>{p}</span>;
        return (
          <a key={i} href={`tel:${m[1]}`} className="font-extrabold text-primary underline decoration-[#e8ad88] decoration-[3px] underline-offset-4">
            {m[1] === '211' ? '2-1-1' : m[1]}
          </a>
        );
      })}
    </p>
  );
}

/** Role pages as header links (computer only). */
function DesktopNav() {
  const { t } = useI18n();
  const { role, token } = useApp();
  const isActive = useActive();
  return (
    <nav aria-label="Pages" className="hidden items-center gap-6 lg:flex">
      {ROLE_TABS[role].map(([to, label]) => {
        const active = isActive(to);
        return (
          <NavLink key={to} to={to === '/plan' && token ? `/p/${token}` : to} className={cn('group relative py-2 text-[15px] font-bold', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {t(label)}
            <span
              className={cn('absolute -bottom-0.5 left-0 h-1 -rotate-2 bg-[#f4ad8d] transition-[right] duration-300', active ? 'right-0' : 'right-full group-hover:right-0')}
              style={{ borderRadius: '60% 40% 70% 30%' }}
              aria-hidden="true"
            />
          </NavLink>
        );
      })}
    </nav>
  );
}

function BottomTabs() {
  const { t } = useI18n();
  const { role, token } = useApp();
  const isActive = useActive();
  const tabs = ROLE_TABS[role];
  return (
    <nav aria-label="Tabs" className="no-print fixed inset-x-0 bottom-0 z-30 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1 lg:hidden">
      <div className={cn('cut-2 grid border-2 border-border bg-card/95 p-1 shadow-lift backdrop-blur', tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4')}>
        {tabs.map(([to, label, Icon]) => {
          const active = isActive(to);
          return (
            <NavLink key={to} to={to === '/plan' && token ? `/p/${token}` : to} className={cn('relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 text-[11px] font-bold', active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {active && <motion.span layoutId="tab-pill" className="cut-btn absolute inset-0.5 bg-primary shadow-amber" transition={{ type: 'spring', stiffness: 420, damping: 32 }} aria-hidden="true" />}
              <Icon className="relative h-5 w-5" aria-hidden="true" />
              <span className="relative">{t(label)}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function Header() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { role, live } = useApp();
  return (
    <header className="no-print sticky top-0 z-30 bg-background/85 shadow-[0_1px_0_rgba(53,97,73,0.1)] backdrop-blur">
      <div className="mx-auto flex min-h-[68px] max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:min-h-[80px] lg:gap-8">
        <button type="button" onClick={() => navigate(ROLE_TABS[role][0][0])} className="flex -rotate-1 items-center gap-2.5 rounded-lg font-display text-xl font-bold tracking-[-0.05em]" aria-label={`${t('app.name')} — home`}>
          <span className="cut-blob flex h-10 w-10 items-center justify-center bg-card shadow-[4px_5px_0_#f8c96e]">
            <LoopRing size={28} />
          </span>
          <span className="hidden min-[360px]:inline">{t('app.name')}</span>
        </button>
        <DesktopNav />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {live && <span className="mr-2 hidden text-xs font-semibold text-muted-foreground xl:inline">{t('demo.clock', { time: formatTime(live.clock.now, lang) })}</span>}
          <RoleSwitcher />
          <LanguageButton />
          <DemoMenu />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="no-print mt-16 bg-[#e7efdf] pb-28 dark:bg-[#1b3b2d] lg:pb-0" style={{ borderRadius: '73px 29px 0 0 / 42px 61px 0 0' }}>
      <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
        <CrisisFooter />
        <nav className="flex gap-5 text-sm font-bold" aria-label="Footer">
          <NavLink to="/about" className="hover:underline">{t('nav.about')}</NavLink>
          <NavLink to="/trust" className="hover:underline">{t('nav.trust')}</NavLink>
        </nav>
      </div>
    </footer>
  );
}

export default function Shell() {
  const { t, lang } = useI18n();
  const { live } = useApp();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const wide = FULL_WIDTH.includes(pathname);

  return (
    <div className="relative min-h-screen">
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[70] rounded-lg bg-primary px-4 py-2 text-primary-foreground">
        {t('app.skip')}
      </a>
      <Toasts />
      <Header />
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="no-print flex items-center justify-between gap-2 py-2">
          <DemoBadge />
          <span className="text-xs font-semibold text-muted-foreground xl:hidden">{live ? t('demo.clock', { time: formatTime(live.clock.now, lang) }) : ''}</span>
        </div>
        {IS_LOCAL && <p className="no-print cut-5 mb-2 bg-muted px-3 py-1.5 text-xs text-muted-foreground">{t('demo.localMode')}</p>}
        <div className={cn('lg:grid lg:items-start lg:gap-10', wide ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_400px]')}>
          <main id="main" tabIndex={-1} className={cn('min-w-0 pb-6 focus:outline-none', !wide && 'mx-auto w-full max-w-[760px] lg:mx-0')}>
            {/* Pages load lazily; suspend only this area so the header and live panel stay mounted. */}
            <Suspense fallback={<div className="mt-4 space-y-3"><div className="skeleton h-8 w-2/3" /><div className="skeleton cut-5 h-40" /></div>}>
              <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
                <Outlet />
              </motion.div>
            </Suspense>
          </main>
          {!wide && (
            <aside className="no-print sticky top-24 hidden h-[calc(100vh-7rem)] min-w-0 lg:flex" aria-label={t('map.title')}>
              <Suspense fallback={<div className="skeleton cut-4 h-full w-full" />}>
                <LivePanel />
              </Suspense>
            </aside>
          )}
        </div>
      </div>
      <Footer />
      <BottomTabs />
    </div>
  );
}
