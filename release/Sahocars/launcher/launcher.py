import os
import sys
import subprocess
import tkinter as tk
from tkinter import messagebox
from pathlib import Path
import os
import sys
import subprocess
import tkinter as tk
from tkinter import messagebox
from pathlib import Path
import signal
import webbrowser

# ==============================
# SAHOCARS LAUNCHER
# ==============================

REPO_ROOT = Path(r"C:\sahocars")
BACKEND_DIR = REPO_ROOT / "backend"
FRONTEND_DIR = REPO_ROOT / "frontend"

BACKEND_PORT = 8000
FRONTEND_PORT = 5173

# Ajusta si tu FastAPI usa otra ruta
# Ejemplos:
# "main:app"
# "app.main:app"
UVICORN_APP = "main:app"

WINDOWS = os.name == "nt"

backend_proc = None
frontend_proc = None


# ---------- Helpers ----------

def ensure_paths():
    if not REPO_ROOT.exists():
        raise FileNotFoundError(f"No existe {REPO_ROOT}")
    if not (REPO_ROOT / ".git").exists():
        raise FileNotFoundError(f"{REPO_ROOT} no es un repo git válido")
    if not BACKEND_DIR.exists():
        raise FileNotFoundError(f"No existe {BACKEND_DIR}")
    if not FRONTEND_DIR.exists():
        raise FileNotFoundError(f"No existe {FRONTEND_DIR}")


def popen(cmd, cwd: Path):
    creationflags = subprocess.CREATE_NEW_CONSOLE if WINDOWS else 0
    return subprocess.Popen(cmd, cwd=str(cwd), creationflags=creationflags)


def run_sync(cmd, cwd: Path):
    creationflags = subprocess.CREATE_NEW_CONSOLE if WINDOWS else 0
    p = subprocess.Popen(cmd, cwd=str(cwd), creationflags=creationflags)
    return p.wait()


def terminate_tree(proc):
    if not proc:
        return
    if proc.poll() is not None:
        return
    try:
        if WINDOWS:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                check=False
            )
        else:
            proc.send_signal(signal.SIGTERM)
    except Exception:
        pass


# ---------- Actions ----------

def start_services():
    global backend_proc, frontend_proc
    try:
        ensure_paths()
    except Exception as e:
        messagebox.showerror("Error", str(e))
        return

    # Backend
    if backend_proc is None or backend_proc.poll() is not None:
        backend_cmd = [
            sys.executable,
            "-m", "uvicorn",
            UVICORN_APP,
            "--reload",
            "--host", "127.0.0.1",
            "--port", str(BACKEND_PORT),
        ]
        backend_proc = popen(backend_cmd, BACKEND_DIR)

    # Frontend
    if frontend_proc is None or frontend_proc.poll() is not None:
        frontend_cmd = [
            "npm.cmd", "run", "dev", "--",
            "--host", "127.0.0.1",
            "--port", str(FRONTEND_PORT),
        ]
        frontend_proc = popen(frontend_cmd, FRONTEND_DIR)

    status_var.set("Backend y Frontend en marcha")


def stop_services():
    global backend_proc, frontend_proc
    terminate_tree(frontend_proc)
    terminate_tree(backend_proc)
    frontend_proc = None
    backend_proc = None
    status_var.set("Servicios parados")


def update_project():
    try:
        ensure_paths()
    except Exception as e:
        messagebox.showerror("Error", str(e))
        return

    stop_services()

    # Git pull (seguro, sin reset hard)
    rc = run_sync(["git", "pull"], REPO_ROOT)
    if rc != 0:
        messagebox.showwarning(
            "Actualizar",
            "git pull terminó con errores.\nRevisa la consola."
        )
        return

    # Backend deps
    req = BACKEND_DIR / "requirements.txt"
    if req.exists():
        run_sync(
            [sys.executable, "-m", "pip", "install", "-r", str(req)],
            BACKEND_DIR
        )

    # Frontend deps
    lock = FRONTEND_DIR / "package-lock.json"
    if lock.exists():
        run_sync(["npm", "ci"], FRONTEND_DIR)
    else:
        run_sync(["npm", "install"], FRONTEND_DIR)

    status_var.set("Proyecto actualizado")


def open_frontend():
    webbrowser.open(f"http://localhost:{FRONTEND_PORT}")


def open_backend_docs():
    webbrowser.open(f"http://localhost:{BACKEND_PORT}/docs")


def exit_app():
    stop_services()
    root.destroy()


# ---------- UI ----------

root = tk.Tk()
root.title("Sahocars Launcher")
root.geometry("520x260")
root.resizable(False, False)

tk.Label(
    root,
    text="Sahocars Launcher",
    font=("Segoe UI", 16, "bold")
).pack(pady=10)

tk.Label(
    root,
    text=f"Backend: http://localhost:{BACKEND_PORT}   |   Frontend: http://localhost:{FRONTEND_PORT}",
    font=("Segoe UI", 9)
).pack(pady=2)

buttons = tk.Frame(root)
buttons.pack(pady=15)

tk.Button(buttons, text="Iniciar", width=14, height=2, command=start_services)\
    .grid(row=0, column=0, padx=8)
tk.Button(buttons, text="Actualizar", width=14, height=2, command=update_project)\
    .grid(row=0, column=1, padx=8)
tk.Button(buttons, text="Parar", width=14, height=2, command=stop_services)\
    .grid(row=0, column=2, padx=8)

links = tk.Frame(root)
links.pack(pady=5)

tk.Button(links, text="Abrir Frontend", width=16, command=open_frontend)\
    .grid(row=0, column=0, padx=8)
tk.Button(links, text="Abrir Backend /docs", width=16, command=open_backend_docs)\
    .grid(row=0, column=1, padx=8)
tk.Button(links, text="Salir", width=16, command=exit_app)\
    .grid(row=0, column=2, padx=8)

status_var = tk.StringVar(value="Parado")
tk.Label(root, textvariable=status_var, font=("Segoe UI", 10)).pack(pady=12)

root.protocol("WM_DELETE_WINDOW", exit_app)
root.mainloop()


