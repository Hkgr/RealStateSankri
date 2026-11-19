-- Property documents (scans, contracts, field visits). Kept apart from schema.sql on purpose: `db:import` rebuilds
-- the sheet's tables and must not touch these, and parcel ids change on every import, so a document is linked to
-- a parcel by region name and minute number, not by parcel id.
-- Created by `npm run docs:ingest` (CREATE TABLE IF NOT EXISTS, safe to run again).

-- One row per distinct file content. The same scan filed under 35 parcels is one row here, stored once.
CREATE TABLE IF NOT EXISTS documents (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sha256     CHAR(64) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  mime       VARCHAR(120) NOT NULL,
  ext        VARCHAR(12) NOT NULL,
  kind       ENUM('pdf','image','sheet','other') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_documents_sha (sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Where each document was filed: which parcel, under which heading, with its original name.
CREATE TABLE IF NOT EXISTS parcel_documents (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  region_name   VARCHAR(80) NOT NULL,
  minute_base   INT UNSIGNED NULL COMMENT 'null for a file that sits at the region level',
  scope         ENUM('parcel','region') NOT NULL DEFAULT 'parcel',
  document_id   INT UNSIGNED NOT NULL,
  category      ENUM('annotations','records','surveys','visits','contracts','other') NOT NULL,
  title         VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  original_path VARCHAR(600) NOT NULL,
  doc_date      DATE NULL,
  annotation_ref INT UNSIGNED NULL COMMENT 'رقم الإشارة when the file is an annotation',
  group_label   VARCHAR(255) NULL,
  sort_order    INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_parcel_documents_path (region_name, original_path(300)),
  KEY ix_parcel_documents_parcel (region_name, minute_base),
  KEY ix_parcel_documents_document (document_id),
  KEY ix_parcel_documents_annotation (region_name, annotation_ref),
  CONSTRAINT fk_parcel_documents_document FOREIGN KEY (document_id) REFERENCES documents (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
