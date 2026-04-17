-- Habilitar extensión pgvector (DEBE ir antes de crear tablas con vector columns)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Comentario: Alembic maneja el resto del schema.
-- Este script solo instala extensiones que deben existir antes del primer migrate.
