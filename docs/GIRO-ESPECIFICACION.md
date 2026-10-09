# Giro 2027 — especificación (pendiente de montar)

Documento de traspaso: lo que Carlos pidió el 8-oct-2026 para pre-montar el
Giro. Después se clonará la misma configuración para el Tour y la Vuelta.
**Implementado el 9-oct-2026** (commit 7c5127d): motor en `src/lib/grand-tour.ts`,
datos en `src/lib/grand-tour-data.ts`, admin en `/giro/admin` y `/giro/precios`.
Pendiente: cargar corredores, precios y recorrido del Giro 2027, y clonar a Tour y Vuelta
(basta con poner `budget_cap`, `budget_squad_size`, `budget_bench_size` y
`real_team_pick_size` en su fila de `competitions`).

Referencia de cómo funcionaba la app anterior (Vuelta, mismo sistema que el
Giro): https://charlylopez-png.github.io/vuelta-txirridulariak/ — sacar de
ahí las Etapas y la pestaña Data, pero manteniendo la configuración de abajo.

## Pestañas de la competición

### Inicio
Además de las pestañas: el **equipo propio con los puntos que lleva** en ese
momento y la **clasificación general de los participantes**.

### Reglamento
- Cada equipo parte de un **presupuesto de 2000 puntos**.
- Antes de la fecha límite debe formar un equipo de **9 ciclistas** dentro de
  ese presupuesto. Cada corredor tiene un precio en puntos.
- Además tiene **2 suplentes**. Solo entran por **caída o retirada por
  enfermedad** de un titular. El participante elige cuál de sus suplentes
  entra.
- El suplente debe valer **menos** que el corredor al que sustituye (nunca
  igual ni más). **Excepción:** si el sustituido está en el escalón más bajo
  (**50 pt**), puede entrar otro de 50.
- Si no tiene ningún suplente que cumpla la condición, no puede sustituir y
  juega con el equipo incompleto.
- Los suplentes **solo puntúan desde la etapa en la que entran**.
- Puntuación: ver tablas abajo.

### Edición 2026
Top 10 de la edición pasada (ya existe: `/[slug]/edicion-anterior`, con la
general del Giro 2026 cargada en `competition_result_history` y el nombre en
`race_editions`).

### Mi equipo
- Aquí se eligen los **9 titulares y los 2 suplentes**.
- El admin (Carlos) o un miembro del sanedrín pone el **precio** a cada
  corredor.
- La app va calculando el presupuesto gastado y lo que queda, cuántos
  corredores lleva y cuántos faltan, con indicadores que ayuden a elegir.
- Arriba, la **fecha de cierre** de la plantilla y el equipo elegido; debajo
  se mantiene el selector por si cambia de opinión antes del cierre.
- **Pasada la fecha de cierre, solo se ve el equipo elegido.**
- Más adelante: estadísticas de los corredores.

### Etapas
Todas las etapas, como en la versión anterior de la app (ver el enlace).

### Clasificación
La **general** y la de la **última etapa**. Al pulsar en un equipo se ven
sus corredores con sus puntos.

### Data
Lo mismo que en la app original (ver el enlace).

## Sistema de puntuación

### Cada etapa (se suma cada día)
| Clasificación | Puntos |
|---|---|
| Etapa (top 10) | 1º 100 · 2º 80 · 3º 70 · 4º 60 · 5º 50 · 6º 40 · 7º 30 · 8º 20 · 9º 10 · 10º 5 |
| Clasificación general (top 10) | 1º 50 · 2º 45 · 3º 40 · 4º 35 · 5º 30 · 6º 25 · 7º 20 · 8º 15 · 9º 10 · 10º 5 |
| Regularidad / puntos (top 5) | 1º 25 · 2º 20 · 3º 15 · 4º 10 · 5º 5 |
| KOM / montaña (top 5) | 1º 25 · 2º 20 · 3º 15 · 4º 10 · 5º 5 |
| Equipos (top 5) | 1º 25 · 2º 20 · 3º 15 · 4º 10 · 5º 5 |

### Bonus final (solo una vez, al acabar la vuelta)
| Clasificación | Puntos |
|---|---|
| General final (top 10) | 1º 600 · 2º 400 · 3º 200 · 4º 125 · 5º 100 · 6º 80 · 7º 70 · 8º 60 · 9º 50 · 10º 40 |
| Regularidad final (top 5) | 1º 125 · 2º 75 · 3º 50 · 4º 30 · 5º 15 |
| Montaña final (top 5) | 1º 125 · 2º 75 · 3º 50 · 4º 30 · 5º 15 |
| Equipos final (top 5) | 1º 125 · 2º 75 · 3º 50 · 4º 30 · 5º 15 |

(La captura original seguía más abajo; si había más bloques, pedírselos a
Carlos.)

## Contexto técnico útil
- Producción: Vercel, proyecto `gran-web-app-porra-ciclista` (push a `main`
  despliega). Base de datos: Supabase, proyecto `jtefiowmgshjcweuyyjj`.
- Los despliegues Preview de Vercel **no tienen `DATABASE_URL`**: sirven para
  comprobar que compila, pero las páginas fallan ahí.
- Giro/Tour/Vuelta ya existen en `competitions` con `game_type =
  'budget_draft'` y columnas `budget_squad_size`, `budget_cap`. Hay una tabla
  `stage_result_lists` en `db/schema.sql` pensada para los resultados por
  etapa. La pantalla de reglamento de budget_draft está en
  `src/components/competition-reglamento.tsx` (`BudgetDraftReglamento`).
- Toda la app es para la temporada **2027**.
