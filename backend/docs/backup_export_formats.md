# Backup and export formats

This document records the fields, values, and formats used by the full backup and vehicle export features. It is intended as a stable reference for future database changes or conversion utilities.

## Full backup (POST /admin/backups)

Outputs are stored in `BACKUP_DIR` (default: `backend/backups`). Each backup uses the SQLite backup API and then creates a manifest JSON and, optionally, a files zip.

Files created per backup id:
- `backup_<YYYYMMDD>_<HHMMSS>_<suffix>.sqlite`
- `backup_<YYYYMMDD>_<HHMMSS>_<suffix>.manifest.json`
- `backup_<YYYYMMDD>_<HHMMSS>_<suffix>.files.zip` (only if `include_files=true`)

Manifest fields (`.manifest.json`):
- `id` (string) backup id, `YYYYMMDD_HHMMSS_<suffix>`
- `filename` (string) sqlite filename
- `created_at` (string) UTC ISO 8601, `datetime.utcnow().isoformat()`
- `size_bytes` (int) size of sqlite file
- `sha256` (string) hex sha256 of sqlite file
- `db_engine` (string) `sqlite`
- `app_version` (string) from `app.version.__version__` or `0.0.0`
- `schema_version` (string) `sqlite_user_version:<int>`
- `backup_method` (string) `sqlite_backup_api`
- `restore_method` (string) `staged_swap`
- `integrity_check` (string) result of `PRAGMA integrity_check`
- `files_included` (bool)
- `files_filename` (string | null)
- `files_size_bytes` (int | null)
- `files_sha256` (string | null)
- `warnings` (array of string)

Files archive (`.files.zip`):
- Zips the entire `STORAGE_ROOT` directory (default: `backend/storage`).
- Paths are relative to `STORAGE_ROOT`.
- Includes both `vehicles/` and `vehiculos/` subtrees if present.

Restore behavior (POST /admin/backups/{id}/restore):
- Validates manifest hashes and SQLite integrity before restore.
- Restores into a staging directory and swaps atomically.
- Optionally restores files zip into `STORAGE_ROOT`.

## Vehicle export package (POST /admin/vehicles/export)

Produces a zip with `manifest.json`, `data.json`, and optional `files/` content.

Manifest fields (`manifest.json`):
- `package_id` (string) `YYYYMMDD_HHMMSS_<suffix>`
- `created_at` (string) UTC ISO 8601
- `app_version` (string)
- `schema_version` (string) `sqlite_user_version:<int>`
- `vehicles_count` (int)
- `files_included` (bool)
- `files_count` (int)
- `data_sha256` (string) hex sha256 of `data.json`
- `zip_sha256` (string) hex sha256 of the full zip
- `warnings` (array of string)

`data.json` format:
- UTF-8 JSON, `ensure_ascii=true` (non-ASCII is escaped).
- `default=str` for values: dates and datetimes serialize as strings.
- Top-level keys:
  - `vehicles`
  - `vehicle_expenses`
  - `legacy_expenses`
  - `vehicle_visits`
  - `vehicle_links`
  - `vehicle_files`
  - `sales`
  - `sale_documents`
  - `documents`
  - `photos`
  - `transfers`
  - `events`
  - `file_entries`

Record fields (direct SQLModel dumps; all fields may be present):
- `vehicles`: `license_plate`, `vin`, `brand`, `model`, `version`, `year`, `km`, `color`, `branch_id`, `status`, `status_changed_at`, `status_reason`, `sold_at`, `reserved_until`, `purchase_date`, `sale_price`, `sale_notes`, `sale_date`, `notes`, `created_at`, `updated_at`
- `vehicle_expenses`: `id`, `vehicle_id`, `amount`, `currency`, `date`, `category`, `vendor`, `invoice_ref`, `payment_method`, `notes`, `linked_vehicle_file_id`, `created_at`, `updated_at`
- `legacy_expenses`: `id`, `vehicle_id`, `concept`, `amount`, `expense_date`, `notes`, `created_at`
- `vehicle_visits`: `id`, `vehicle_id`, `visit_date`, `name`, `phone`, `email`, `notes`, `created_at`
- `vehicle_links`: `id`, `vehicle_id`, `title`, `url`, `created_at`
- `vehicle_files`: `id`, `vehicle_id`, `category`, `original_name`, `stored_name`, `mime_type`, `size_bytes`, `notes`, `created_at`
- `sales`: `id`, `vehicle_id`, `sale_price`, `sale_date`, `notes`, `client_name`, `client_tax_id`, `client_phone`, `client_email`, `client_address`, `created_at`
- `sale_documents`: `id`, `vehicle_id`, `sale_id`, `original_name`, `stored_name`, `mime_type`, `size_bytes`, `notes`, `created_at`
- `documents`: `id`, `vehicle_id`, `doc_type`, `file_name`, `stored_path`, `uploaded_at`, `notes`
- `photos`: `id`, `vehicle_id`, `file_name`, `stored_path`, `display_order`, `uploaded_at`
- `transfers`: `id`, `vehicle_id`, `from_branch_id`, `to_branch_id`, `transfer_date`, `notes`, `created_at`
- `events`: `id`, `vehicle_id`, `type`, `payload`, `actor`, `created_at`

Relationships and id references:
- `vehicle_id` ties records to `vehicles.license_plate`.
- `vehicle_expenses.linked_vehicle_file_id` references `vehicle_files.id`.
- `sale_documents.sale_id` references `sales.id`.
- IDs from `data.json` are source IDs only; import creates new IDs.

File entries (`file_entries`):
- Array of objects that map exported files to zip paths.
- Shape: `{ "export_path": "files/...", "type": <string>, "vehicle_id": <plate>, "id": <int>, ... }`.
- Types: `vehicle_file`, `sale_document`, `document`, `photo`.
- Paths in zip (relative to zip root):
  - `files/vehicles/<plate_key>/<stored_name>` for `vehicle_file`
  - `files/vehicles/<plate_key>/sale-documents/<stored_name>` for `sale_document`
  - `files/vehiculos/<plate_key>/documentos/<file_name>` for `document`
  - `files/vehiculos/<plate_key>/fotos/<file_name>` for `photo`
- `plate_key` is the sanitized plate (alnum, dash, underscore; other chars become `_`).

## CSV export (GET /export/vehicles)

- Header columns (in order):
  `vin,license_plate,brand,model,version,year,km,color,branch_id,status,purchase_date,sale_price,sale_date`
- Values are joined with commas, no quoting.
- Any commas in values are replaced with spaces before export.
- Dates use `YYYY-MM-DD` (empty if null).
- Numbers are stringified as-is.

Known limitations of CSV export:
- Lossy for any value containing commas (they are replaced by spaces).
- No escaping for newlines.

## Source references
- Full backup implementation: `backend/services/backup_service.py`
- Vehicle export package: `backend/services/vehicle_transfer_service.py`
- Export endpoints: `backend/routers/admin_backup.py`, `backend/routers/admin_vehicle_transfer.py`, `backend/main.py`
