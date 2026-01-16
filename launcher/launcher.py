import os
import time
import threading
import subprocess
import webbrowser
import shutil
import tkinter as tk
from tkinter import ttk, messagebox
import urllib.request
import urllib.error

# ==================================================
# CONFIGURACIÓN FIJA DEL PROYECTO
# ==================================================
ROOT = r"C:\sahocars"
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")

BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 8000
FRONTEND_HOST = "127.0.0.1"
FRONTEND_PORT = 5173

BACKEND_VENV_PY = os.path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe")

BACKEND_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}/docs"
FRONTEND_URL = f"http://{FRONTEND_HOST}:{FRONTEND_PORT}/"

# ==================================================
# UTILIDADES
# ==================================================
def http_ok(url, timeout=1.0):
    try:
        with urllib.request.urlopen(url, timeout=timeout):
            return True
    except:
        return False

def find_npm():
    npm = shutil.which("npm")
    if npm:
        return npm
    fallback = r"C:\Program Files\nodejs\npm.cmd"
    if os.path.exists(fallback):
        return fallback
    raise FileNotFoundError("No se encuentra npm")

def taskkill(pid):
    subprocess.run(
        ["taskkill", "/PID", str(pid), "/T", "/F"],
        capture_output=True
    )

# ==================================================
# LAUNCHER
# ==================================================
class SahocarsLauncher(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Sahocars Launcher")
        self.geometry("900x520")

        self.backend_proc = None
        self.frontend_proc = None
        self.running = False

        self.build_ui()
        self.log("Launcher listo. Pulsa Iniciar.")

    # ---------------- UI ----------------
    def build_ui(self):
        top = ttk.Frame(self, padding=10)
        top.pack(fill="x")

        self.btn_start = ttk.Button(top, text="Iniciar", command=self.start)
        self.btn_start.pack(side="left", padx=5)

        self.btn_update = ttk.Button(top, text="Actualizar", command=self.update)
        self.btn_update.pack(side="left", padx=5)

        self.btn_exit = ttk.Button(top, text="Salir", command=self.exit)
        self.btn_exit.pack(side="left", padx=5)

        self.status = ttk.Label(top, text="Estado: parado")
        self.status.pack(side="left", padx=20)

        self.progress = ttk.Progressbar(top, mode="indeterminate", length=200)
        self.progress.pack(side="right")

        frame = ttk.Frame(self, padding=10)
        frame.pack(fill="both", expand=True)

        self.text = tk.Text(frame, wrap="word")
        self.text.pack(side="left", fill="both", expand=True)

        scroll = ttk.Scrollbar(frame, command=self.text.yview)
        scroll.pack(side="right", fill="y")
        self.text.configure(yscrollcommand=scroll.set)

    # ---------------- LOG ----------------
    def log(self, msg):
        ts = time.strftime("%H:%M:%S")
        self.text.insert("end", f"[{ts}] {msg}\n")
        self.text.see("end")
        self.update_idletasks()

    def set_status(self, txt):
        self.status.config(text=f"Estado: {txt}")
        self.update_idletasks()

    # ---------------- START ----------------
    def start(self):
        if self.running:
            messagebox.showinfo("Sahocars", "Ya está en ejecución")
            return

        self.progress.start(10)
        self.set_status("arrancando...")
        self.btn_start.config(state="disabled")

        def runner():
            try:
                npm = find_npm()
                python = BACKEND_VENV_PY if os.path.exists(BACKEND_VENV_PY) else "python"

                self.log("Arrancando backend...")
                self.backend_proc = subprocess.Popen(
                    [python, "-m", "uvicorn", "main:app",
                     "--reload", "--host", BACKEND_HOST, "--port", str(BACKEND_PORT)],
                    cwd=BACKEND_DIR
                )

                self.log("Arrancando frontend...")
                self.frontend_proc = subprocess.Popen(
                    [npm, "run", "dev", "--", "--host", FRONTEND_HOST, "--port", str(FRONTEND_PORT)],
                    cwd=FRONTEND_DIR
                )

                self.log("Esperando servicios...")
                for _ in range(60):
                    if http_ok(FRONTEND_URL):
                        self.running = True
                        self.set_status("listo")
                        self.log("Servicios listos. Abriendo navegador.")
                        webbrowser.open(FRONTEND_URL)
                        return
                    time.sleep(1)

                messagebox.showwarning("Timeout", "No han arrancado a tiempo")

            except Exception as e:
                messagebox.showerror("Error", str(e))
            finally:
                self.progress.stop()
                self.btn_start.config(state="normal")

        threading.Thread(target=runner, daemon=True).start()

    # ---------------- UPDATE ----------------
    def update(self):
        self.log("Actualizando proyecto...")
        self.progress.start(10)
        self.set_status("actualizando...")

        def updater():
            try:
                self.stop_services()

                subprocess.run(["git", "fetch"], cwd=ROOT)

                local = subprocess.check_output(
                    ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
                ).strip()
                remote = subprocess.check_output(
                    ["git", "rev-parse", "origin/main"], cwd=ROOT, text=True
                ).strip()

                if local == remote:
                    self.log("No hay cambios.")
                    self.set_status("listo")
                    return

                self.log("Cambios detectados. Haciendo pull...")
                pull = subprocess.run(["git", "pull"], cwd=ROOT)
                if pull.returncode != 0:
                    messagebox.showerror("Git", "Error en git pull")
                    return

                self.log("Repositorio actualizado.")

                if os.path.exists(os.path.join(BACKEND_DIR, "requirements.txt")):
                    self.log("Actualizando backend deps...")
                    subprocess.run(
                        [BACKEND_VENV_PY, "-m", "pip", "install", "-r", "requirements.txt"],
                        cwd=BACKEND_DIR
                    )

                self.log("Actualizando frontend deps...")
                subprocess.run([find_npm(), "install"], cwd=FRONTEND_DIR)

                self.log("Reiniciando servicios...")
                self.start()

            finally:
                self.progress.stop()

        threading.Thread(target=updater, daemon=True).start()

    # ---------------- STOP ----------------
    def stop_services(self):
        if self.frontend_proc:
            taskkill(self.frontend_proc.pid)
            self.frontend_proc = None

        if self.backend_proc:
            taskkill(self.backend_proc.pid)
            self.backend_proc = None

        self.running = False

    # ---------------- EXIT ----------------
    def exit(self):
        self.log("Cerrando Sahocars...")
        self.stop_services()
        self.destroy()


if __name__ == "__main__":
    SahocarsLauncher().mainloop()
