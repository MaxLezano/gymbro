/** Standard gym plates in kg, heaviest first. */
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
export const BAR_KG = 20;

/** Equipment loaded with plates on a standard 20 kg bar. */
const PLATE_LOADED = new Set(['barbell', 'olympic barbell']);

export const usesPlates = (equipment?: string) => !!equipment && PLATE_LOADED.has(equipment);

export interface PlateLoad {
  /** Plates for ONE side, heaviest first. */
  perSide: number[];
  /** Weight that cannot be made with the plates (0 when exact). */
  leftover: number;
}

/** Greedy split works for standard plate sets: fewest plates, heaviest closest to the collar. */
export function platesFor(totalKg: number, barKg = BAR_KG, plates = PLATES_KG): PlateLoad | null {
  if (totalKg <= barKg) return null;
  let side = (totalKg - barKg) / 2;
  const perSide: number[] = [];
  for (const plate of plates) {
    while (side >= plate - 1e-9) {
      perSide.push(plate);
      side -= plate;
    }
  }
  return { perSide, leftover: Math.round(side * 2 * 100) / 100 };
}

/** "20 + 5 + 1,25" */
export const formatPlates = (perSide: number[]) => perSide.map((plate) => plate.toLocaleString('es-ES')).join(' + ');
