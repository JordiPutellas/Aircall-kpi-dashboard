-- Migración 005: helpers de zona horaria (Europe/Madrid).
-- Centralizan la aritmética de "día" y "jornada laboral" en hora de Madrid que
-- estaba duplicada en las queries del dashboard. Cambiar la zona horaria o el
-- horario laboral pasa a ser un único punto de edición (estas funciones), en
-- lugar de ~15 copias dispersas que podían descuadrarse en silencio.
--
-- Son STABLE (dependen de la base de datos de zonas horarias, no IMMUTABLE).

-- Hora "de pared" local en Madrid (timestamp sin tz). Útil para comparar por
-- ::date / ::time. Equivale a `ts AT TIME ZONE 'Europe/Madrid'`.
CREATE OR REPLACE FUNCTION madrid_local(ts timestamptz)
RETURNS timestamp AS $$
  SELECT ts AT TIME ZONE 'Europe/Madrid'
$$ LANGUAGE sql STABLE;

-- Inicio del día (00:00 hora de Madrid) que contiene `ts`, como timestamptz.
CREATE OR REPLACE FUNCTION madrid_day_start(ts timestamptz)
RETURNS timestamptz AS $$
  SELECT date_trunc('day', ts AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
$$ LANGUAGE sql STABLE;

-- Fin del día: inicio del día siguiente (00:00 Madrid del día +1).
CREATE OR REPLACE FUNCTION madrid_day_end(ts timestamptz)
RETURNS timestamptz AS $$
  SELECT madrid_day_start(ts) + interval '1 day'
$$ LANGUAGE sql STABLE;

-- Inicio de jornada: 09:00 hora de Madrid del día que contiene `ts`.
CREATE OR REPLACE FUNCTION madrid_work_start(ts timestamptz)
RETURNS timestamptz AS $$
  SELECT (date_trunc('day', ts AT TIME ZONE 'Europe/Madrid') + interval '9 hours') AT TIME ZONE 'Europe/Madrid'
$$ LANGUAGE sql STABLE;

-- Fin de jornada: 18:00 hora de Madrid del día que contiene `ts`.
CREATE OR REPLACE FUNCTION madrid_work_end(ts timestamptz)
RETURNS timestamptz AS $$
  SELECT (date_trunc('day', ts AT TIME ZONE 'Europe/Madrid') + interval '18 hours') AT TIME ZONE 'Europe/Madrid'
$$ LANGUAGE sql STABLE;
