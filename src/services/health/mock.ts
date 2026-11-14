import type { HealthProvider } from './types';

let granted = false;

/** Datos simulados de un reloj vía Health Connect (deterministas por fecha). Solo si el usuario elige "simulado". */
export const mockHealth: HealthProvider = {
  id: 'mock',
  label: 'Health Connect (simulado)',
  simulated: true,
  async availability() {
    return 'available';
  },
  async requestPermissions() {
    granted = true;
    return true;
  },
  async hasPermissions() {
    return granted;
  },
  async readDaily(date: string) {
    const seed = date.split('-').reduce((a, b) => a * 31 + Number(b), 7);
    const wobble = ((seed % 11) / 10) - 0.5; // −0,5 … +0,5
    return {
      sleepHours: Math.round((7.1 + wobble * 1.6) * 100) / 100,
      restingHr: 57 + Math.round(wobble * 6),
      restingHrBaseline: 57,
      source: 'Simulado',
    };
  },
  async saveExercise(e) {
    await new Promise((r) => setTimeout(r, 600));
    return `mock-hc-${e.startTime}`;
  },
};
