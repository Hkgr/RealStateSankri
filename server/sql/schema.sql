-- Real-estate (land consolidation) database. MariaDB 10.6+ / MySQL 8+, utf8mb4, InnoDB.
-- The importer drops and recreates these tables from the Excel sheet on every run.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS annotations;
DROP TABLE IF EXISTS purchases;
DROP TABLE IF EXISTS parcel_owners;
DROP TABLE IF EXISTS parcels;
DROP TABLE IF EXISTS annotation_categories;
DROP TABLE IF EXISTS ownership_groups;
DROP TABLE IF EXISTS regions;
SET FOREIGN_KEY_CHECKS = 1;

-- Cadastral areas ("اسم المنطقة").
CREATE TABLE regions (
  id      SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name_ar VARCHAR(80) NOT NULL,
  UNIQUE KEY uq_regions_name (name_ar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Who owns the parcel ("الملكية"): the sheet's four labels.
CREATE TABLE ownership_groups (
  code       VARCHAR(20) NOT NULL PRIMARY KEY,
  name_ar    VARCHAR(80) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kinds of registry annotation ("نوع الإشارة"). The sheet fills the kind for ~30% of rows;
-- the rest is derived from the annotation text (see annotations.category_source).
CREATE TABLE annotation_categories (
  code       VARCHAR(30) NOT NULL PRIMARY KEY,
  name_ar    VARCHAR(80) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per parcel ("محضر"): the first data row of each block in the sheet.
CREATE TABLE parcels (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  region_id            SMALLINT UNSIGNED NOT NULL,
  minute_no            VARCHAR(80) NOT NULL COMMENT 'رقم المحضر كما كُتب، مثل "1431 متضرر"',
  minute_base          INT UNSIGNED NULL COMMENT 'أول رقم في رقم المحضر، للفرز',
  property_type        ENUM('land','apartment') NOT NULL DEFAULT 'land' COMMENT 'الشقق السكنية حالة خاصة: بلا مساحة أرض',
  is_damaged           TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'متضرر',
  ownership_group      VARCHAR(20) NOT NULL,
  kashf16_ref          VARCHAR(40) NULL COMMENT 'م ك16: رقم البند/البنود في الكشف 16',
  land_status          ENUM('full','joint') NULL COMMENT 'وضع العقار عند الشراء: التمام / الشيوع',
  registry_status      VARCHAR(300) NULL COMMENT 'الوضع الراهن في الصحيفة العقارية',
  asali_registered_on  DATE NULL,
  asali_registered_raw VARCHAR(255) NULL,
  first_purchase_date  DATE NULL COMMENT 'أقدم تاريخ شراء بالعقد لهذا المحضر',
  acquisition_method   ENUM('transfer','judgment','judgment_then_transfer') NULL COMMENT 'فراغة / حكم',
  transfer_date        DATE NULL COMMENT 'تاريخ الفراغة لـ د. سنكري',
  judgment_date        DATE NULL COMMENT 'تاريخ الحكم لـ د. سنكري',
  transfer_raw         VARCHAR(255) NULL,
  minute_area          DECIMAL(14,3) NULL COMMENT 'الملكية من مساحة المحضر (م²)',
  total_area           DECIMAL(14,3) NULL COMMENT 'المساحة الإجمالية (م²)',
  total_shares         DECIMAL(12,3) NULL COMMENT 'الحصة السهمية (من 2400)',
  sankari_shares       DECIMAL(12,3) NULL,
  asali_shares         DECIMAL(12,3) NULL,
  k16_area             DECIMAL(14,3) NULL COMMENT 'المساحة بحسب الكشف 16',
  k16_value_syp        DECIMAL(18,2) NULL,
  k16_value_usd        DECIMAL(18,3) NULL,
  sankari_value_usd    DECIMAL(18,3) NULL,
  asali_value_usd      DECIMAL(18,3) NULL,
  notes                TEXT NULL,
  source_row_start     INT UNSIGNED NOT NULL COMMENT 'رقم الصف في ملف الإكسل',
  source_row_end       INT UNSIGNED NOT NULL,
  merged_source_rows   VARCHAR(80) NULL COMMENT 'صفوف إكسل إضافية لنفس المحضر دُمجت فيه',
  KEY ix_parcels_region (region_id),
  KEY ix_parcels_group (ownership_group),
  KEY ix_parcels_minute (minute_base),
  KEY ix_parcels_purchase (first_purchase_date),
  CONSTRAINT fk_parcels_region FOREIGN KEY (region_id) REFERENCES regions (id),
  CONSTRAINT fk_parcels_group FOREIGN KEY (ownership_group) REFERENCES ownership_groups (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase contracts ("تاريخ الشراء بالعقد" / "تم شراء العقار من قبل..."). A parcel merged from several
-- minutes can carry more than one contract.
CREATE TABLE purchases (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  parcel_id     INT UNSIGNED NOT NULL,
  seq           SMALLINT UNSIGNED NOT NULL,
  purchase_date DATE NULL,
  date_raw      VARCHAR(120) NULL,
  purchased_by  VARCHAR(255) NULL,
  channel       ENUM('broker','agent','principal','accounting','other') NULL,
  source_row    INT UNSIGNED NOT NULL,
  KEY ix_purchases_parcel (parcel_id),
  KEY ix_purchases_date (purchase_date),
  CONSTRAINT fk_purchases_parcel FOREIGN KEY (parcel_id) REFERENCES parcels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registered owners listed under parcels that are not ours yet ("أراضي ذات مشاكل").
CREATE TABLE parcel_owners (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  parcel_id  INT UNSIGNED NOT NULL,
  seq        SMALLINT UNSIGNED NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  shares     DECIMAL(12,3) NULL,
  area       DECIMAL(14,3) NULL,
  source_row INT UNSIGNED NOT NULL,
  KEY ix_owners_parcel (parcel_id),
  CONSTRAINT fk_owners_parcel FOREIGN KEY (parcel_id) REFERENCES parcels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registry annotations ("الإشارات") placed on a parcel: arbitration, security, liquidation, state...
CREATE TABLE annotations (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  parcel_id           INT UNSIGNED NOT NULL,
  seq                 SMALLINT UNSIGNED NOT NULL,
  ref_no              INT UNSIGNED NULL COMMENT 'رقم الإشارة',
  ref_date            DATE NULL COMMENT 'null عندما يُعرف العام فقط',
  ref_year            SMALLINT UNSIGNED NULL,
  ref_date_raw        VARCHAR(60) NULL,
  placed_by           VARCHAR(255) NULL COMMENT 'اسم واضع الإشارة',
  category            VARCHAR(30) NOT NULL,
  category_source     ENUM('sheet','derived') NOT NULL,
  placed_on           VARCHAR(255) NULL COMMENT 'على من وضعت الإشارة',
  target_party        ENUM('sankari','asali','both','other') NULL,
  target_shares       DECIMAL(12,3) NULL COMMENT 'مجموع الأسهم المذكورة في «على من وضعت»',
  timing              ENUM('before_purchase','before_transfer','after_transfer','before_judgment','after_judgment') NULL,
  row_sankari_shares  DECIMAL(12,3) NULL COMMENT 'حصة د. سنكري المكتوبة في صف الإشارة نفسه',
  row_asali_shares    DECIMAL(12,3) NULL,
  source_row          INT UNSIGNED NOT NULL,
  KEY ix_ann_parcel (parcel_id),
  KEY ix_ann_category (category),
  KEY ix_ann_year (ref_year),
  KEY ix_ann_placed_by (placed_by(100)),
  CONSTRAINT fk_ann_parcel FOREIGN KEY (parcel_id) REFERENCES parcels (id) ON DELETE CASCADE,
  CONSTRAINT fk_ann_category FOREIGN KEY (category) REFERENCES annotation_categories (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ownership_groups (code, name_ar, sort_order) VALUES
  ('sankari_100',   'د. سنكري 100%',            1),
  ('joint_75_25',   'د. سنكري 75% + عسلي 25%',  2),
  ('asali_100',     'عسلي 100%',                3),
  ('problem',       'أراضي ذات مشاكل',          4),
  ('unclassified',  'غير مصنّف',                5);

INSERT INTO annotation_categories (code, name_ar, sort_order) VALUES
  ('arbitration',      'دعوى تحكيمية',     1),
  ('security',         'إشارة أمنية',      2),
  ('liquidation',      'تصفية شركة',       3),
  ('state',            'دولة / استملاك',   4),
  ('cancellation',     'فسخ تسجيل',        5),
  ('private_claim',    'دعوى / قيد أفراد', 6);
