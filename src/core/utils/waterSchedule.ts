export interface WaterSchedule {
  everyHours: number;
  fromHour: number;
  toHour: number;
}

/** Upper bound of water slots ever scheduled (every hour from 0 to 23). */
export const MAX_WATER_SLOTS = 24;

/** Hours of the day the water reminder fires, e.g. every 2 h from 9 to 21 -> 9, 11, ..., 21. */
export function waterHours({ everyHours, fromHour, toHour }: WaterSchedule): number[] {
  const hours: number[] = [];
  for (let hour = fromHour; hour <= toHour && hours.length < MAX_WATER_SLOTS; hour += Math.max(1, everyHours)) hours.push(hour);
  return hours;
}
