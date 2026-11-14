# Pace · MVP funcional (solo Android, uso personal)

App de running con recomendación diaria (plan + recuperación + clima), plan adaptativo,
grabación de carreras con GPS, rutas, zapatillas y métricas. Expo SDK 58 · expo-router ·
expo-sqlite (todo local, sin cuentas ni servidores propios).

## Probar en el teléfono (Expo Go)

    npm install
    npx expo start        # escanear el QR con Expo Go (Android)

Al abrir por primera vez aparece el **onboarding**. "Borrar todos los datos" en Ajustes lo repite.

## Flujo de punta a punta

1. **Onboarding** (`app/onboarding.tsx`): nombre, edad (→ FC máx Tanaka, editable), peso opcional,
   nivel o tiempo de 5K, objetivo 5K/10K/21K + fecha, días disponibles, ubicación (GPS con
   expo-location o búsqueda de ciudad con Open-Meteo geocoding). Editable desde Perfil.
2. **Plan** (`src/engine/plans.ts`): semanas desde el lunes actual hasta la carrera, progresión
   ×1,5 máx., descarga cada 4.ª semana, taper, día largo (dom/sáb), calidad lejos del largo.
   Calendario semanal real en Planes; marcar hecha/saltar/mover. Adaptación:
   R10 sesión clave perdida → se mueve a un suave posterior de la semana;
   R11 ≥2 perdidas en 7 días → −10 % los 7 días siguientes; R8 ajuste del día al guardar la carrera.
3. **Hoy**: recomendación con reglas R1–R9 + S1 (clima Open-Meteo con caché, recuperación).
4. **Recuperación manual** (`app/recuperacion.tsx`): sueño y FC en reposo del día.
5. **Carrera** → `app/live.tsx`: GPS real en primer plano o simulado (sobre una ruta o un
   circuito libre alrededor de casa), voz por km opcional. Al terminar se guarda, se marca la
   sesión del plan y se avisa si las zapatillas pasan 550/600 km (notificación local).
6. **Resumen** (`app/resumen/[id].tsx`): parciales, diagnóstico, cambiar zapatilla, exportar
   GPX/JSON (expo-sharing), guardar como ruta, borrar, "Guardar en Health Connect" (simulado).
7. **Historial** (`app/historial.tsx`), **Métricas** (volumen semanal, ritmo medio, tendencia
   90 días, km por zapatilla, sueño vs ritmo; estados vacíos claros).
8. **Rutas** (`app/ruta/[id].tsx`): nombre, superficie, sombra, borrar, perfil de elevación de
   Open-Meteo. Se crean guardando una carrera como ruta; las de ejemplo son opcionales (Ajustes).
9. **Zapatillas** (`equipo`, `app/zapatilla/[id].tsx`): CRUD, por defecto, retirar/reactivar.
10. **Ajustes**: km/mi, voz, fuente de recuperación, GPS por defecto, borrar todo.

## Qué sigue simulado

| Pieza | En Expo Go | En dev build |
|---|---|---|
| Health Connect (leer sueño/FC, escribir sesión) | mock (`src/services/health/mock.ts`) | `healthConnect.devbuild.ts` |
| Mapa | trazado SVG propio (`RouteMap`) | MapLibre |
| GPS en segundo plano | solo primer plano + keep-awake | `background.devbuild.ts` (expo-task-manager) |
| Dibujar rutas en mapa | no (sin mapa nativo) | con MapLibre |

## Scripts

    npx tsc --noEmit
    npx jest
    npx expo-doctor
    npx expo export --platform android --output-dir /tmp/pace-export   # solo bundle JS

## Estructura

    app/                 pantallas (expo-router)
    src/engine/          lógica pura y testeada: rules, plans, paces, metrics, gpx, geo, run, diagnosis, format
    src/db/              esquema SQLite v1 + repositorio
    src/services/        clima, salud, ubicación, notificaciones, exportación
    src/state/           Today (contexto del día), Settings, acciones, sesión de carrera
    src/engine/__tests__/ jest (66 tests)

## Pendiente para el dev build
Health Connect real, MapLibre, GPS en segundo plano, dibujo de rutas. Requiere `expo prebuild`
/ EAS: no se ha ejecutado.
