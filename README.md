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

## Frontend (React + Vite + Mantine)

```
cd frontend
npm install
npm run dev
```

La web usa VITE_API_URL (por defecto http://127.0.0.1:8000).
