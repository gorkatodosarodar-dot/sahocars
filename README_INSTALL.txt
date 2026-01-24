SAHOCARS - INSTALACION Y ACTUALIZACION (WINDOWS)
================================================

Requisitos
- Python 3.11
- Node.js + npm

Instalacion (PC nuevo)
1) Descomprime el ZIP.
2) Doble click en install.bat
3) Doble click en start.bat
4) Verifica http://127.0.0.1:8000/health

Arranque
- Doble click en start.bat

Datos
- Se guardan en el DATA DIR:
  %LOCALAPPDATA%\Sahocars\data
  (o el valor de SAHOCARS_DATA_DIR)

Actualizar a nueva version
1) Cierra la app (backend y frontend).
2) Descomprime la nueva version en una carpeta aparte.
3) Ejecuta update.bat apuntando a la nueva carpeta:
   update.bat "C:\Ruta\NuevaVersion\Sahocars"
4) Si /health OK, actualizacion correcta.

Rollback (si algo falla)
- Ejecuta rollback.bat
- Verifica /health

Notas
- El DATA DIR no se toca al actualizar.
- update.bat crea backup automatico antes de tocar codigo.
