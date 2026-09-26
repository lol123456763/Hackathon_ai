// FICTIONAL demo data for the youth side of Loop: interests, weekly schedules, and recurring
// volunteer projects with shifts. Labeled as sample data in the app.

export const INTERESTS = ['food_rescue', 'tutoring', 'elders', 'environment', 'civic', 'community_events', 'arts'];

// Where each student starts from (their school, never a home address).
export const SCHOOLS = {
  eastbank_high: { name: 'Eastbank High (sample)', lat: 30.2301, lng: -97.7183 },
  eastbank_middle: { name: 'Eastbank Middle (sample)', lat: 30.227, lng: -97.717 },
  acc_riverside: { name: 'Austin CC Riverside (sample)', lat: 30.2289, lng: -97.7004 },
};

export const VOLUNTEER_PROFILES = {
  jordan: { interests: ['food_rescue', 'tutoring', 'environment'], school: 'eastbank_high', weekly_goal_hours: 3, stats: { committed: 10, completed: 9 } },
  maya: { interests: ['food_rescue', 'arts', 'elders'], school: 'eastbank_high', weekly_goal_hours: 2, stats: { committed: 8, completed: 7 } },
  ana: { interests: ['environment', 'community_events', 'tutoring'], school: 'eastbank_middle', weekly_goal_hours: 2, stats: { committed: 4, completed: 3 } },
  sam: { interests: ['food_rescue', 'civic', 'elders'], school: 'acc_riverside', weekly_goal_hours: 4, stats: { committed: 13, completed: 12 } },
};

const WEEKDAYS = [1, 2, 3, 4, 5];

// Weekly recurring calendar blocks (days: 0 = Sunday … 6 = Saturday).
// Jordan's afternoon after robotics is free, which is exactly when the golden-path bakery run happens.
export const CALENDARS = {
  jordan: [
    { kind: 'school', title: 'School', days: WEEKDAYS, start: '08:00', end: '15:30' },
    { kind: 'activity', title: 'Robotics club', days: [2, 4], start: '15:45', end: '17:00' },
    { kind: 'personal', title: 'Family dinner', days: [0, 1, 2, 3, 4, 5, 6], start: '18:30', end: '19:15' },
    { kind: 'homework', title: 'Homework', days: [0, 1, 2, 3, 4], start: '19:30', end: '21:00' },
    { kind: 'activity', title: 'Soccer', days: [6], start: '10:00', end: '12:00' },
  ],
  maya: [
    { kind: 'school', title: 'School', days: WEEKDAYS, start: '08:00', end: '15:30' },
    { kind: 'activity', title: 'Art club', days: [1, 3], start: '15:45', end: '17:00' },
    { kind: 'homework', title: 'Homework', days: [0, 1, 2, 3, 4], start: '19:00', end: '20:30' },
    { kind: 'personal', title: 'Church', days: [0], start: '10:00', end: '12:00' },
  ],
  ana: [
    { kind: 'school', title: 'School', days: WEEKDAYS, start: '08:15', end: '15:45' },
    { kind: 'activity', title: 'Band practice', days: [2], start: '16:00', end: '17:30' },
    { kind: 'homework', title: 'Homework', days: [0, 1, 2, 3, 4], start: '18:00', end: '19:30' },
  ],
  sam: [
    { kind: 'school', title: 'Classes', days: [1, 3, 5], start: '09:00', end: '12:00' },
    { kind: 'personal', title: 'Work', days: [2, 4, 6], start: '13:00', end: '19:00' },
  ],
};

// Recurring volunteer projects. Each slot repeats on its days. All places are hubs or public sites.
export const PROJECTS = [
  {
    key: 'fridge-restock', type: 'food_rescue', interests: ['food_rescue'], hub_key: 'riverside-fridge', place: 'Riverside Community Fridge', lat: 30.2385, lng: -97.7215,
    slots: [{ days: [1, 2, 3, 4, 5, 6], start: '16:00', end: '17:00' }], min_age: 13, spots: 3, need: 2, hours_credit: 1, checkin_code: '3170',
    title_en: 'Fridge restock shift', title_es: 'Turno para llenar el refrigerador',
    description_en: 'Sort donations, check dates, and restock the community fridge with the host.',
    description_es: 'Organiza donaciones, revisa fechas y llena el refrigerador comunitario con la persona encargada.',
    impact_en: 'keeps the fridge full for about 20 families', impact_es: 'mantiene lleno el refrigerador para unas 20 familias',
  },
  {
    key: 'homework-help', type: 'tutoring', interests: ['tutoring'], hub_key: 'grove-closet', place: 'Grove Free Closet & Fridge (rec center)', lat: 30.233, lng: -97.705,
    slots: [{ days: [2, 4], start: '16:00', end: '17:30' }, { days: [3], start: '17:00', end: '18:00' }], min_age: 14, spots: 4, need: 2, hours_credit: 1.5, checkin_code: '4402',
    title_en: 'Homework help for younger kids', title_es: 'Ayuda con la tarea para niños',
    description_en: 'Read with kids and help with math homework at the rec center, with an adult coordinator.',
    description_es: 'Lee con niños y ayuda con la tarea de matemáticas en el centro recreativo, con un coordinador adulto.',
    impact_en: 'helps about 8 kids keep up in school', impact_es: 'ayuda a unos 8 niños a ir al día en la escuela',
  },
  {
    key: 'senior-calls', type: 'elders', interests: ['elders'], hub_key: null, place: 'From home (phone)', lat: null, lng: null, remote: true,
    slots: [{ days: [0, 1, 2, 3, 4, 5, 6], start: '17:30', end: '18:00' }, { days: [6], start: '14:00', end: '14:30' }], min_age: 13, spots: 6, need: 1, hours_credit: 0.5, checkin_code: '2255',
    title_en: 'Senior phone buddies', title_es: 'Llamadas a adultos mayores',
    description_en: 'Call an older neighbor on the phone list for a friendly check-in. A coordinator dials you in; your number stays private.',
    description_es: 'Llama a un adulto mayor de la lista para platicar y saber cómo está. Un coordinador conecta la llamada; tu número se mantiene privado.',
    impact_en: 'less loneliness for 2 older neighbors', impact_es: 'menos soledad para 2 vecinos mayores',
  },
  {
    key: 'creek-garden', type: 'environment', interests: ['environment'], hub_key: null, place: 'Country Club Creek community garden', lat: 30.2262, lng: -97.7135,
    slots: [{ days: [6], start: '08:30', end: '10:00' }, { days: [0], start: '15:00', end: '16:30' }], min_age: 13, spots: 8, need: 1, hours_credit: 1.5, checkin_code: '6130',
    title_en: 'Community garden workday', title_es: 'Día de trabajo en el huerto comunitario',
    description_en: 'Weed, water and harvest vegetables that go to the Riverside fridge.',
    description_es: 'Quita hierba, riega y cosecha verduras que van al refrigerador de Riverside.',
    impact_en: 'fresh vegetables for the community fridge', impact_es: 'verduras frescas para el refrigerador comunitario',
  },
  {
    key: 'civic-table', type: 'civic', interests: ['civic', 'community_events'], hub_key: 'grove-closet', place: 'Grove rec center lobby', lat: 30.233, lng: -97.705,
    slots: [{ days: [6], start: '12:30', end: '14:00' }], min_age: 16, spots: 3, need: 1, hours_credit: 1.5, checkin_code: '8812',
    title_en: 'Civic info table (non-partisan)', title_es: 'Mesa de información cívica (sin partido)',
    description_en: 'Help neighbors look up their polling place, city services and 2-1-1 on a tablet. No campaigning.',
    description_es: 'Ayuda a los vecinos a buscar su lugar de votación, servicios de la ciudad y el 2-1-1 en una tableta. Sin hacer campaña.',
    impact_en: 'helps neighbors find civic info', impact_es: 'ayuda a los vecinos a encontrar información cívica',
  },
  {
    key: 'pantry-sort', type: 'food_rescue', interests: ['food_rescue', 'community_events'], hub_key: 'oltorf-pantry', place: 'Oltorf Pantry Shelf', lat: 30.229, lng: -97.726,
    slots: [{ days: [6], start: '12:30', end: '14:00' }, { days: [2, 4], start: '16:00', end: '17:30' }], min_age: 13, spots: 4, need: 2, hours_credit: 1.5, checkin_code: '5077',
    title_en: 'Pantry sorting', title_es: 'Organizar la despensa',
    description_en: 'Sort canned and dry food by date and category so families can find what they need.',
    description_es: 'Organiza comida enlatada y seca por fecha y tipo para que las familias encuentren lo que necesitan.',
    impact_en: 'faster pantry visits for families', impact_es: 'visitas más rápidas a la despensa para las familias',
  },
];
