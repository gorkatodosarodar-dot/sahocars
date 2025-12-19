# Sahocars

Pila local ligera para gestionar vehículos, gastos, ventas y documentos de las sedes de Montgat y Juneda.

## Backend (FastAPI + SQLite)

```
cd backend
python -m venv .venv
source .venv/bin/activate  # En Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

La API corre por defecto en `http://localhost:8000` y crea un SQLite local (`sahocars.db`) y la carpeta `storage/` para ficheros.

## Frontend (React + Vite + Mantine)

```
cd frontend
npm install
npm run dev
```

La web usa la variable `VITE_API_URL` (por defecto `http://localhost:8000`).
