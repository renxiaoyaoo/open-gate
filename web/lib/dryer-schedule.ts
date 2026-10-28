export type TimedProgram = { minutes: number };

export function scheduledStart(time: string, now = new Date()) {
  const [hours, minutes] = time.split(":").map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target;
}

export function finishAt(start: string, program?: TimedProgram, now = new Date()) {
  if (!program) return "—";
  const date = scheduledStart(start, now);
  date.setMinutes(date.getMinutes() + program.minutes);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function appointmentDelay(start: string, program?: TimedProgram, now = new Date()) {
  if (!program) return 1;
  const finish = scheduledStart(start, now);
  finish.setMinutes(finish.getMinutes() + program.minutes);
  return Math.max(1, Math.ceil((finish.getTime() - now.getTime()) / 60_000));
}
