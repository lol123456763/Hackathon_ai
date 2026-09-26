import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Card, Skeleton } from './ui';

export default function PlanLoading() {
  const { t } = useI18n();
  const steps = t('plan.loadingSteps');
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 1400);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <div className="container-page max-w-3xl py-10" aria-busy="true">
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        <p className="text-lg font-semibold">{Array.isArray(steps) ? steps[i] : t('plan.loading')}</p>
      </div>
      <div className="mt-6 grid gap-4">
        {[0, 1, 2].map((k) => (
          <Card key={k} className="p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
