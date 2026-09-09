# QNT-0030 · Seller Intake "Drop your EA" — Plan de implementación

**Estado:** documento de arquitectura. **No implementado.** `DOWNLOADS_ENABLED=false`.

**Mensaje principal (copy):**

> Drop your EA.
> We evaluate it before publication.

## 1. Flujo del vendedor

1. Crear cuenta o iniciar sesión (auth existente de Quantora).
2. Aceptar términos (aceptación versionada, una sola pantalla con casillas separadas):
   - Seller Terms;
   - autorización para analizar el archivo enviado;
   - declaración de propiedad o derechos de distribución;
   - política de privacidad;
   - prohibición de malware y de código de terceros no autorizado;
   - consentimiento para almacenar y evaluar el envío.
3. Arrastrar archivos:
   - `.ex5` obligatorio (primera versión);
   - `.set` opcional;
   - PDF o documentación opcional;
   - resultados/evidencia opcional (CSV/JSON del pipeline de intake).
4. Información mínima: nombre del EA, versión, MetaTrader 5 (build), mercados admitidos, timeframes, depósito recomendado, requisitos, costes no incluidos, descripción breve, datos de contacto.
5. Un clic: **Submit for evaluation**.
6. Estados visibles en todo momento (sección 3).
7. Tras aprobación: Quantora configura ficha, evidencia y términos comerciales.
8. Publicación: un clic administrativo de Quantora. **Nunca publicación automática del vendedor.**

## 2. Estados del envío

`Draft → Uploaded → Submitted → Automated checks → Under Quantora review → Changes requested → Approved → Ready to publish → Published` con salidas `Rejected` (desde revisión o checks) y `Suspended` (post-publicación).
Transiciones server-side con registro de actor y fecha en `audit_events`. El vendedor solo puede: crear, editar en `Draft/Changes requested`, enviar a evaluación y retirar (si política lo permite).

## 3. Diferencia obligatoria: submit vs. publish

- **Vendedor:** un clic — *Submit for evaluation*. No existe acción de publicación para el vendedor (ni en UI ni en server functions ni en RLS).
- **Quantora (admin):** un clic — *Approve and publish*, disponible **solo** cuando se cumplen TODAS:
  1. términos aceptados y versionados;
  2. archivos recibidos y en cuarentena superada;
  3. controles automáticos completados (integridad, hashes, pipeline de evidencia, sin EX5/PDF sospechosos);
  4. revisión humana completada con veredicto aprobado;
  5. evidencia aceptada;
  6. ficha pública creada y revisada;
  7. condiciones comerciales aprobadas;
  8. estado de Stripe Connect válido (cuando haya pagos de vendedores).

## 4. Seguridad de archivos

- Nunca guardar `.ex5/.set/.dll` en GitHub. Almacenamiento privado (bucket con acceso solo server-side).
- URLs firmadas de corta duración (p. ej. 5–10 min) y solo para el propietario del envío o revisores autorizados.
- Autenticación obligatoria + autorización server-side en cada acceso.
- Límites estrictos de tipo (whitelist) y tamaño por archivo.
- Nombre interno aleatorio (uuid) + hash criptográfico (sha256) + registro de versión.
- Estado de cuarentena inicial para todo archivo hasta pasar checks automáticos.
- No ejecutar el archivo en Vercel ni en el servidor web. No cargarlo automáticamente en MT5 de producción.
- Preparar análisis antivirus/malware (proveedor externo o pipeline interno) antes de la revisión humana.
- Registrar usuario, fecha, términos aceptados y versión de términos en cada envío.
- Permitir revocación/eliminación según política, con auditoría de accesos completa.
- Aislamiento estricto: un vendedor nunca ve archivos de otros vendedores (RLS + filtrado server-side).
- Archivos grandes: **carga directa autenticada** al almacenamiento privado mediante tokens cortos / URLs firmadas de subida (evita límites de tamaño de Vercel Functions). El backend solo recibe metadatos + hash.

## 5. Modelo de datos propuesto (diseño, sin migrar)

- `seller_profiles`: user_id (único), display_name, contact_email, country, status, terms_version_accepted, created_at.
- `seller_terms_acceptances`: id, user_id, terms_type (`seller|privacy|analysis|ownership`), terms_version, accepted_at, ip_hash.
- `ea_submissions`: id, seller_user_id, status, name, version, mt5_build, markets, timeframes, recommended_deposit, requirements, excluded_costs, short_description, contact, current_version_id, created_at, updated_at.
- `ea_submission_files`: id, submission_id, version_id, kind (`ex5|set|pdf|evidence`), storage_path (privado, nombre aleatorio), sha256, size_bytes, mime, quarantine_status, scan_status, uploaded_at.
- `ea_submission_versions`: id, submission_id, semver, notes, created_by, created_at.
- `ea_evidence`: id, submission_id, kind, storage_path, sha256, accepted_by, accepted_at.
- `ea_reviews`: id, submission_id, reviewer, state (`in_review|approved|rejected|changes_requested`), notes, decided_at.
- `ea_review_findings`: id, review_id, severity, category, description, file_id (nullable).
- `ea_approvals`: id, submission_id, approved_by, checklist_json (los 8 puntos de la sección 3), approved_at.
- `publication_releases`: id, submission_id, strategy_id (ficha pública), released_by, released_at, notes.
- `seller_products`: id, submission_id, commercial_model (`rent|buy|both`), price_cents, currency (definidos por Quantora tras aprobación), stripe_product_id, stripe_price_id, active.
- `seller_payout_accounts`: user_id (único), stripe_account_id, charges_enabled, payouts_enabled, status, updated_at.
- `audit_events`: id, actor, actor_role, action, entity, entity_id, metadata_json, created_at.

## 6. RLS propuesto (resumen)

- `ea_submissions`, `ea_submission_files`, `ea_submission_versions`, `ea_evidence`: SELECT/UPDATE/INSERT solo cuando `seller_user_id = auth.uid()`; los revisores/admin vía role claim en JWT; el vendedor nunca ve archivos ajenos (no existe fila visible).
- `ea_reviews`, `ea_review_findings`, `ea_approvals`, `publication_releases`: solo admin/revisor (RLS por rol); lectura del vendedor limitada a estado agregado vía vista.
- `seller_profiles`, `seller_terms_acceptances`: self-access por `auth.uid()`; admin total.
- `seller_products`, `seller_payout_accounts`: solo admin/Quantora para escritura; lectura self.
- `audit_events`: insert-only para todos; lectura solo admin.
- Toda operación sensible pasa además por server functions con autorización server-side (defensa en profundidad, no solo RLS).

## 7. PDF de instalación de Javier (pendiente)

- No se inventa ningún PDF ni se crea enlace roto.
- Campo privado versionado previsto en `publication_releases` / `ea_submission_files` (`kind='install_pdf'`) para incorporarlo al paquete cuando llegue el PDF definitivo.
- Hasta entonces `DOWNLOADS_ENABLED=false` y sin ruta de descarga registrada.

## 8. Fases de implementación

1. Esquema + RLS en staging + términos versionados.
2. Upload directo a storage privado con tokens cortos + cuarentena + hash.
3. Estados del envío + UI del vendedor (drop zone, metadatos, Submit for evaluation).
4. Panel de revisión Quantora (checks automáticos → revisión humana → checklist de publicación).
5. Conexión con catálogo público y, más adelante, con Stripe Connect (QNT-0025 §7).

