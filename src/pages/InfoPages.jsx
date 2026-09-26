import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles, Database, Users, ArrowRight, Lock } from 'lucide-react';
import { useI18n } from '@/i18n';
import STATS from '@data/stats.json';
import { Button, Card } from '@/components/ui';

export function About() {
  const { t } = useI18n();
  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('about.title')}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{t('about.lead')}</p>

      <h2 className="mt-10 text-xl font-semibold">{t('about.stepsTitle')}</h2>
      <ol className="mt-4 space-y-3">
        {[t('about.step1'), t('about.step2', { count: STATS.resources.toLocaleString() }), t('about.step3'), t('about.step4')].map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
            <p className="pt-1">{s}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Database className="h-5 w-5 text-primary" aria-hidden="true" /> {t('about.dataTitle')}
          </h2>
          <p className="mt-2 text-muted-foreground">{t('about.data')}</p>
        </Card>
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" /> {t('about.aiTitle')}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {['ai1', 'ai2', 'ai3', 'ai4'].map((k) => (
              <li key={k}>{t(`about.${k}`)}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5 text-primary" aria-hidden="true" /> {t('about.teamTitle')}
        </h2>
        <p className="mt-2 text-muted-foreground">{t('about.team')}</p>
      </Card>

      <div className="mt-10 text-center">
        <Button as={Link} to="/" size="lg" variant="accent">
          {t('about.cta')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function Privacy() {
  const { t } = useI18n();
  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <h1 className="flex items-center gap-3 font-display text-3xl font-bold sm:text-4xl">
        <Lock className="h-8 w-8 text-primary" aria-hidden="true" /> {t('privacy.title')}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{t('privacy.lead')}</p>
      <ul className="mt-8 space-y-3">
        {t('privacy.items').map((item) => (
          <li key={item} className="flex gap-3 rounded-xl border bg-card p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 text-xl font-semibold">{t('privacy.rightsTitle')}</h2>
      <p className="mt-2 text-muted-foreground">{t('privacy.rights')}</p>
      <p className="mt-6 text-sm text-muted-foreground">{t('privacy.contact')}</p>
    </div>
  );
}

export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="container-page max-w-xl py-20 text-center">
      <h1 className="font-display text-4xl font-bold">{t('common.notFoundTitle')}</h1>
      <p className="mt-3 text-muted-foreground">{t('common.notFoundBody')}</p>
      <Button as={Link} to="/" className="mt-6">
        {t('common.goHome')}
      </Button>
    </div>
  );
}
