/** Кожна воронка має свій колір (як типи подій у Calendly). Колір стабільний: залежить від ID воронки. */
const PALETTE = [
  '#8247F5', // фіолетовий
  '#0099FF', // синій
  '#E55CFF', // рожевий
  '#FF8C00', // помаранчевий
  '#12B76A', // зелений
  '#0AB5CC', // бірюзовий
  '#F8463F', // червоний
  '#F5B000', // жовтий
  '#4F5DF5', // індиго
  '#E8457C', // малиновий
  '#00A88F', // смарагдовий
  '#A86CFF', // бузковий
];
export const NO_PIPELINE_COLOR = '#94A0B2';

export function pipelineColor(id: number | null | undefined): string {
  if (id === null || id === undefined || !Number.isFinite(id)) return NO_PIPELINE_COLOR;
  return PALETTE[(((Math.trunc(id) - 1) % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

/** Напівпрозорий відтінок кольору для фону (hex + alpha). */
export function tint(hex: string, alpha = 0.12): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}
