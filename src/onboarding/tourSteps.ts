export interface TourStep {
  /** Pestaña donde se muestra el paso. */
  route: '/home' | '/ingresos' | '/gastos' | '/presupuesto' | '/cuentas';
  /** Selector CSS del elemento señalado. */
  target: string;
  title: string;
  text: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    route: '/home',
    target: '[data-tour="home-summary"]',
    title: 'Tu resumen',
    text: 'Aquí ves cuánto te queda disponible este mes, con lo que entró y lo que salió.',
  },
  {
    route: '/home',
    target: '.app-bottom-nav',
    title: 'Secciones',
    text: 'Desde esta barra pasas a Ingresos, Gastos, Presupuesto y Cuentas.',
  },
  {
    route: '/cuentas',
    target: '[data-tour="accounts-new"]',
    title: 'Primero, tus cuentas',
    text: 'Agrega dónde tienes tu dinero (cuenta vista, corriente, efectivo…) con su saldo actual.',
  },
  {
    route: '/ingresos',
    target: '[data-tour="mv-new"]',
    title: 'Anota tus ingresos',
    text: 'Registra lo que recibes. Las categorías las creas desde el mismo formulario.',
  },
  {
    route: '/ingresos',
    target: '[data-tour="mv-tabs"]',
    title: 'Ingresos fijos',
    text: 'En Fijos agregas tu sueldo u otros montos que se repiten: se anotan solos cada mes.',
  },
  {
    route: '/gastos',
    target: '.app-month-switcher',
    title: 'Cambia de mes',
    text: 'Desliza el dedo a los lados para pasar de un mes a otro, o toca el mes para elegir cualquiera.',
  },
  {
    route: '/presupuesto',
    target: '[data-tour="budget-assign"]',
    title: 'Tu presupuesto',
    text: 'Asigna un monto mensual a cada categoría de gasto y mira cuánto te queda.',
  },
  {
    route: '/home',
    target: '[aria-label="Ver recorrido"]',
    title: '¡Listo!',
    text: 'Si quieres ver este recorrido de nuevo, tócalo aquí.',
  },
];
