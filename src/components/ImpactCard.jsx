// "Share my impact": a square, image-style card drawn on a canvas and downloadable as a PNG.
// First name + team and totals only — never anything about neighbors.
import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { useI18n } from '@/i18n';
import { mealsFromLbs } from '@shared/loop.js';
import { fmtHours } from '@/lib/format';
import { Button } from './ui';

function drawRing(ctx, cx, cy, r, w) {
  ctx.lineWidth = w;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#0E7C74';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.strokeStyle = '#E8503A';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.stroke();
  ctx.strokeStyle = '#1F7A4D';
  ctx.lineWidth = w * 0.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.35);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.35);
  ctx.stroke();
}

export default function ImpactCard({ me, team }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const firstName = me.display_name.split(' ')[0];
  const lbs = Math.round(me.total_lbs);
  const stats = [
    [String(lbs), t('impact.lbs')],
    [String(mealsFromLbs(lbs)), t('impact.meals')],
    [fmtHours(me.total_hours), t('vol.hours')],
  ];

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const S = 1080;
    c.width = S;
    c.height = S;
    ctx.fillStyle = '#FFF8EE';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#FFE7A8';
    ctx.fillRect(0, S - 150, S, 150);
    drawRing(ctx, 170, 170, 70, 26);
    ctx.fillStyle = '#1B1A17';
    ctx.font = '800 64px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Loop', 270, 190);
    ctx.font = '800 92px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(firstName, 90, 390);
    ctx.fillStyle = '#0E7C74';
    ctx.font = '600 44px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(team || '', 90, 455);
    stats.forEach(([v, l], i) => {
      const x = 90 + i * 320;
      ctx.fillStyle = '#E8503A';
      ctx.font = '800 96px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(v, x, 650);
      ctx.fillStyle = '#3A3833';
      ctx.font = '600 34px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(l, x, 700);
    });
    ctx.fillStyle = '#B8321F';
    ctx.font = '600 30px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`${t('demo.badge')} · ${t('app.tagline')}`.slice(0, 70), 90, S - 65);
  }, [firstName, team, lbs, me.total_hours, t]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      <canvas ref={ref} className="aspect-square w-full rounded-2xl border shadow-soft" role="img" aria-label={`${firstName} · ${team} · ${stats.map((s) => s.join(' ')).join(' · ')}`} />
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const a = document.createElement('a');
          a.href = ref.current.toDataURL('image/png');
          a.download = `loop-impact-${firstName.toLowerCase()}.png`;
          a.click();
        }}
      >
        <Download className="h-4 w-4" aria-hidden="true" /> {t('vol.download')}
      </Button>
    </div>
  );
}
