import {
  Apple, Home, Zap, Stethoscope, GraduationCap, Briefcase, Bus, DollarSign, Scale, HeartHandshake,
} from 'lucide-react';
import { CATEGORIES } from '@shared/constants.js';

export { CATEGORIES };

export const CATEGORY_META = {
  food: { icon: Apple, tint: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  housing: { icon: Home, tint: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  utilities: { icon: Zap, tint: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' },
  healthcare: { icon: Stethoscope, tint: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
  school_childcare: { icon: GraduationCap, tint: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' },
  employment: { icon: Briefcase, tint: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200' },
  transportation: { icon: Bus, tint: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200' },
  cash_assistance: { icon: DollarSign, tint: 'bg-lime-100 text-lime-900 dark:bg-lime-900/40 dark:text-lime-200' },
  legal: { icon: Scale, tint: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
  mental_health: { icon: HeartHandshake, tint: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200' },
};
