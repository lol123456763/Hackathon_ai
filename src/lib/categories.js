import { createElement } from 'react';
import { Icon } from '@/components/icons';
import { CATEGORIES } from '@shared/constants.js';

export { CATEGORIES };

// Each need gets Loop's hand-drawn icon and one of three paper tints (never ten rainbow colors).
const TINT = {
  teal: 'bg-primary-soft text-ink dark:text-foreground',
  tomato: 'bg-accent-soft text-ink dark:text-foreground',
  sun: 'bg-[#FFF1C9] text-ink dark:bg-sun/20 dark:text-foreground',
};

// The offset "print" color behind each drawn icon (stronger than the tile tint so it reads).
const PRINT = { teal: 'hsl(var(--primary) / 0.45)', tomato: 'hsl(var(--accent) / 0.7)', sun: 'hsl(var(--sun))' };

const make = (name, tone) => {
  const C = (props) => createElement(Icon, { name, ...props, tone: PRINT[tone] });
  C.displayName = `Icon(${name})`;
  return { icon: C, tone, tint: TINT[tone] };
};

export const CATEGORY_META = {
  food: make('food', 'tomato'),
  housing: make('housing', 'teal'),
  utilities: make('utilities', 'sun'),
  healthcare: make('healthcare', 'tomato'),
  school_childcare: make('school_childcare', 'sun'),
  employment: make('employment', 'teal'),
  transportation: make('transportation', 'sun'),
  cash_assistance: make('cash_assistance', 'teal'),
  legal: make('legal', 'sun'),
  mental_health: make('mental_health', 'tomato'),
};
