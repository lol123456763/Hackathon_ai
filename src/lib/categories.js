import { Apple, Home, Zap, Stethoscope, GraduationCap, Briefcase, Bus, DollarSign, Scale, HeartHandshake } from 'lucide-react';
import { CATEGORIES } from '@shared/constants.js';

export { CATEGORIES };

// Each need uses one of BenefitBridge's five pastel tile colors.
export const CATEGORY_META = {
  food: { icon: Apple, tint: 'bg-tile-2 text-primary' },
  housing: { icon: Home, tint: 'bg-tile-1 text-primary' },
  utilities: { icon: Zap, tint: 'bg-tile-4 text-primary' },
  healthcare: { icon: Stethoscope, tint: 'bg-tile-3 text-primary' },
  school_childcare: { icon: GraduationCap, tint: 'bg-tile-5 text-primary' },
  employment: { icon: Briefcase, tint: 'bg-tile-1 text-primary' },
  transportation: { icon: Bus, tint: 'bg-tile-4 text-primary' },
  cash_assistance: { icon: DollarSign, tint: 'bg-tile-2 text-primary' },
  legal: { icon: Scale, tint: 'bg-tile-3 text-primary' },
  mental_health: { icon: HeartHandshake, tint: 'bg-tile-5 text-primary' },
};
