import type { RouteInfo } from '../engine/types';

export interface RouteData extends RouteInfo {
  description: string;
  area: string;
  /** trazado APROXIMADO (lat, lon) solo para dibujar; ida y vuelta se dibuja ida */
  path: [number, number][];
  outAndBack: boolean;
  water: string; // puntos de hidratación
}

/**
 * Rutas de EJEMPLO (opcionales: se añaden desde la pestaña Carrera). Superficie y sombra etiquetadas a mano (decisión del plan:
 * no hay API gratuita fiable para sombra). Trazados aproximados.
 */
export const EXAMPLE_ROUTES: RouteData[] = [
  {
    id: 'malecon-5k',
    name: 'Malecón de Santo Domingo',
    area: 'Av. George Washington · Malecón',
    description: 'Pavimento continuo junto al Mar Caribe, ida y vuelta casi plano.',
    distanceKm: 5.24,
    gainM: 18,
    surface: 'asfalto',
    shade: 'media',
    isFavorite: true,
    outAndBack: true,
    water: '2 · cada 1,3 km',
    path: [
      [18.4718, -69.8846],
      [18.4705, -69.8875],
      [18.4689, -69.8903],
      [18.4676, -69.8930],
      [18.4664, -69.8957],
      [18.4651, -69.8985],
      [18.4641, -69.9010],
      [18.4632, -69.9036],
      [18.4624, -69.9063],
    ],
  },
  {
    id: 'mirador-sur-7k',
    name: 'Parque Mirador Sur',
    area: 'Av. Anacaona · Mirador Sur',
    description: 'Avenida arbolada cerrada al tráfico en horario de ejercicio; algo de subida al final.',
    distanceKm: 7,
    gainM: 45,
    surface: 'asfalto',
    shade: 'alta',
    isFavorite: true,
    outAndBack: true,
    water: '1 · en la entrada',
    path: [
      [18.4483, -69.9405],
      [18.4470, -69.9450],
      [18.4458, -69.9497],
      [18.4447, -69.9545],
      [18.4437, -69.9592],
      [18.4430, -69.9640],
      [18.4425, -69.9700],
    ],
  },
  {
    id: 'malecon-10k',
    name: 'Malecón largo',
    area: 'Zona Colonial → Güibia',
    description: 'Versión larga del Malecón para tiradas: plano, mucho sol a partir de las 08:00.',
    distanceKm: 10,
    gainM: 30,
    surface: 'asfalto',
    shade: 'baja',
    isFavorite: false,
    outAndBack: true,
    water: '3 · cada 2,5 km',
    path: [
      [18.4718, -69.8846],
      [18.4689, -69.8903],
      [18.4664, -69.8957],
      [18.4641, -69.9010],
      [18.4624, -69.9063],
      [18.4610, -69.9115],
      [18.4597, -69.9170],
      [18.4585, -69.9225],
      [18.4575, -69.9280],
    ],
  },
];
