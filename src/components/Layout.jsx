import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, Moon, Sun, Languages, Phone } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from './ui';
import { storage } from '@/lib/storage';
import { lastPlan } from '@/state/flow';

export function Logo({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0F766E" />
      <path d="M12 42c6-12 14-18 20-18s14 6 20 18" fill="none" stroke="#F59E0B" strokeWidth="5" strokeLinecap="round" />
      <path d="M18 42V32M32 42V25M46 42V32" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M10 44h44" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    storage.set('bb.theme', next ? 'dark' : 'light');
    setDark(next);
  };
  return { dark, toggle };
}

export function LanguageToggle({ className }) {
  const { t, lang, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
      aria-label={t('nav.switchToLabel')}
      lang={lang === 'en' ? 'es' : 'en'}
      className={cn('inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-input bg-card px-3 text-sm font-semibold hover:bg-muted', className)}
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      {t('nav.switchTo')}
    </button>
  );
}

function Header() {
  const { t } = useI18n();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const saved = lastPlan.get();
  useEffect(() => setOpen(false), [location.pathname]);

  const links = [
    ['/browse', t('nav.browse')],
    ['/about', t('nav.about')],
    ['/privacy', t('nav.privacy')],
  ];
  if (saved?.token) links.unshift([`/plan/${saved.token}`, t('nav.myPlan')]);

  return (
    <header className="no-print sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 rounded-lg font-display text-xl font-bold tracking-tight">
          <Logo className="h-9 w-9" />
          <span>{t('app.name')}</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn('rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted', isActive && 'text-primary')}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? t('nav.themeLight') : t('nav.themeDark')}
            className="hidden h-11 w-11 items-center justify-center rounded-xl hover:bg-muted sm:inline-flex"
          >
            {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t('nav.close') : t('nav.menu')}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t bg-background md:hidden">
          <div className="container-page flex flex-col py-2">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">
                {label}
              </NavLink>
            ))}
            <button type="button" onClick={toggle} className="flex items-center gap-2 rounded-lg px-3 py-3 text-left text-base font-medium hover:bg-muted">
              {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
              {dark ? t('nav.themeLight') : t('nav.themeDark')}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

/** Crisis line text with the numbers as tap-to-call links. */
export function CrisisBannerText() {
  const { t } = useI18n();
  const parts = t('crisis.banner').split(/(\{911\}|\{988\}|\{211\})/);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{(\d+)\}$/);
        if (!m) return <span key={i}>{p}</span>;
        const num = m[1];
        return (
          <a key={i} href={`tel:${num}`} className="font-bold underline underline-offset-2">
            {num === '211' ? '2-1-1' : num}
          </a>
        );
      })}
    </>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="no-print bg-danger-soft">
        <p className="container-page flex items-start gap-2 py-3 text-sm sm:items-center">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-danger sm:mt-0" aria-hidden="true" />
          <span>
            <CrisisBannerText />
          </span>
        </p>
      </div>
      <div className="container-page grid gap-6 py-8 text-sm text-muted-foreground sm:grid-cols-2">
        <div>
          <div className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Logo className="h-7 w-7" /> {t('app.name')}
          </div>
          <p className="mt-2">{t('app.tagline')}</p>
          <p className="mt-2">{t('footer.madeFor')}</p>
        </div>
        <div className="sm:text-right">
          <nav aria-label="Footer" className="no-print flex flex-wrap gap-x-4 gap-y-2 sm:justify-end">
            <Link className="hover:text-foreground hover:underline" to="/browse">{t('nav.browse')}</Link>
            <Link className="hover:text-foreground hover:underline" to="/about">{t('nav.about')}</Link>
            <Link className="hover:text-foreground hover:underline" to="/privacy">{t('nav.privacy')}</Link>
            <Link className="hover:text-foreground hover:underline" to="/admin">{t('nav.admin')}</Link>
          </nav>
          <p className="mt-3">{t('footer.disclaimer')}</p>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground">
        {t('app.skip')}
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
