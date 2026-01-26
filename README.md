# Sahocars

Pila local para gestionar vehiculos, gastos, ventas, visitas y documentos.

## Data dir oficial

Por defecto los datos se guardan en:
- %LOCALAPPDATA%\Sahocars\data

Puedes cambiarlo con:
- SAHOCARS_DATA_DIR

Estructura:
- db.sqlite
- storage/
- backups/
- logs/

Si detecta backend\sahocars.db o backend\storage con datos, se copia automaticamente al data dir en el primer arranque.

## Scripts Windows

Instalacion:
```
install.bat
```

Arranque:
```
start.bat
```

El arranque lee .env.local (si existe) y exporta SAHOCARS_* y VITE_*.
Usa los archivos .env.example de cada carpeta como referencia.

## Flujo de trabajo recomendado

- Rama de trabajo oficial: `validaciones` (cuelga de la linea v2.0 `fase-9c-packaging-update-rollback`).
- Actualizar repo de forma segura: ejecutar `tools\\sync_validaciones.bat`.
- Prohibido: `git pull` sin `--ff-only` (evita merges raros).
- Si `validaciones` apunta a `main`: `git reset --hard origin/validaciones`.

## Backend (FastAPI + SQLite)

```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Endpoints utiles:
- /health
- /version

## Migraciones (Alembic)

```
cd backend
alembic upgrade head
```

Crear nueva migracion:

```
cd backend
alembic revision --autogenerate -m "descripcion"
```

Si falla una migracion, revisar los logs en el data dir y volver a intentar.

## Tests (backend)

```
cd backend
pytest
```

## Frontend (React + Vite + Mantine)

```
cd frontend
npm install
npm run dev
```

La web usa VITE_API_URL (por defecto http://127.0.0.1:8000).
