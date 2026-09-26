import type { Ionicons } from '@expo/vector-icons';

export type TourRoute = '/' | '/train' | '/exercises' | '/progress' | '/nutrition';

export interface TourStep {
  /** TourTarget id to spotlight; without one the bubble is centered over the dimmed screen. */
  target?: string;
  /** Tab to open before measuring the target. */
  route?: TourRoute;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

/** First-run walkthrough: one stop per key element, in the order the tabs appear. */
export const TOUR_STEPS: TourStep[] = [
  {
    route: '/',
    icon: 'sparkles',
    title: '¡Bienvenido a GymBro!',
    body: 'Te muestro la app en un minuto: qué es cada cosa y para qué sirve. Puedes saltarlo cuando quieras.',
  },
  {
    route: '/',
    target: 'home.week',
    icon: 'calendar',
    title: 'Tu semana',
    body: 'Cada día que entrenas se marca aquí. La llama cuenta las semanas seguidas que entrenaste: tu racha.',
  },
  {
    route: '/',
    target: 'home.today',
    icon: 'barbell',
    title: 'Tu entreno de hoy',
    body: 'La sesión que te toca. Toca ▶ y la app te guía serie por serie, con pesos, descansos y técnica.',
  },
  {
    route: '/',
    target: 'header.coach',
    icon: 'chatbubble-ellipses',
    title: 'Coach IA',
    body: 'Pregúntale lo que quieras sobre entrenamiento o comida: arma rutinas, corrige tu técnica o te dice qué merendar.',
  },
  {
    route: '/',
    target: 'header.profile',
    icon: 'person-circle',
    title: 'Tu perfil',
    body: 'Tus datos, tu objetivo y las notificaciones. Si cambias tu peso o tu meta, el plan se recalcula. Desde aquí puedes repetir este tutorial.',
  },
  {
    route: '/train',
    target: 'train.quick',
    icon: 'flash',
    title: 'Entrenar',
    body: 'Empieza un entreno libre, añadiendo ejercicios sobre la marcha, o arma tu propia rutina con el catálogo.',
  },
  {
    route: '/train',
    target: 'train.generate',
    icon: 'sparkles',
    title: 'Rutinas al instante',
    body: 'Elige un foco (pecho, piernas, cuerpo completo…) y la app crea una rutina adaptada a tu equipo, nivel y tiempo.',
  },
  {
    route: '/train',
    target: 'train.program',
    icon: 'calendar-outline',
    title: 'Tu programa semanal',
    body: 'El plan de toda la semana, día por día. En Inicio, «Hoy toca» siempre te muestra el siguiente.',
  },
  {
    route: '/exercises',
    target: 'exercises.search',
    icon: 'search',
    title: 'Catálogo de ejercicios',
    body: 'Busca cualquier ejercicio por nombre, músculo o equipo. Cada uno tiene animación y técnica paso a paso.',
  },
  {
    route: '/progress',
    target: 'progress.weight',
    icon: 'trending-up',
    title: 'Progreso',
    body: 'Registra tu peso y mira cómo evoluciona. Cuando entrenes, más abajo verás tu volumen, tus récords y el historial de sesiones.',
  },
  {
    route: '/nutrition',
    target: 'nutrition.plan',
    icon: 'nutrition',
    title: 'Nutrición',
    body: 'Tus calorías y macros del día, calculados con tus datos. Debajo tienes un menú sugerido, el agua y lo que llevas comido.',
  },
  {
    route: '/',
    target: 'tabbar',
    icon: 'apps',
    title: 'Todo a mano',
    body: 'Con esta barra te mueves entre secciones. ¡Listo, ya puedes empezar!',
  },
];
