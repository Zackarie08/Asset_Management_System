-- ============================================================
-- FULL DATABASE SCHEMA RECONSTRUCTION
-- Source: Backend route files (Express/PostgreSQL)
-- Generated from: routes/*.js analysis
-- ============================================================

-- ============================================================
-- CLEANUP (run in order to respect FK dependencies)
-- ============================================================

DROP VIEW  IF EXISTS v_subscriptions_master CASCADE; ----ok
DROP TABLE IF EXISTS attachments               CASCADE;  ----ok
DROP TABLE IF EXISTS vehicle_maintenance_types CASCADE; ----ok
DROP TABLE IF EXISTS vehicle_maintenance       CASCADE; ----ok
DROP TABLE IF EXISTS vehicle                   CASCADE; ----ok
DROP TABLE IF EXISTS laptop_history            CASCADE; ----ok
DROP TABLE IF EXISTS laptop_maintenance        CASCADE; ----ok
DROP TABLE IF EXISTS laptop                    CASCADE; ----ok
DROP TABLE IF EXISTS contract_requests         CASCADE; ----ok
DROP TABLE IF EXISTS contracts                 CASCADE; ----ok
DROP TABLE IF EXISTS purchase_orders           CASCADE; ----ok
DROP TABLE IF EXISTS inventory_gen             CASCADE; ----ok
DROP TABLE IF EXISTS office_furniture          CASCADE; ----ok
DROP TABLE IF EXISTS it_supplies               CASCADE; ----ok
DROP TABLE IF EXISTS finance_documents         CASCADE; ----ok
DROP TABLE IF EXISTS insurance                 CASCADE; ----ok
DROP TABLE IF EXISTS globe_mobile_plan         CASCADE; ----ok
DROP TABLE IF EXISTS m365                      CASCADE; ----ok
DROP TABLE IF EXISTS subscriptions             CASCADE; ----ok
DROP TABLE IF EXISTS system_log                CASCADE; ----ok
DROP TABLE IF EXISTS location                  CASCADE; ----ok
DROP TABLE IF EXISTS users                     CASCADE; ----ok
----  NO: Attchament Old, Subscriptions Old

-- ============================================================
-- TABLE: users
-- Referenced by: system_log, laptop, laptop_maintenance,
--                contract_requests, globe_mobile_plan,
--                m365, subscriptions, attachments
-- ============================================================

CREATE TABLE users (
    user_id    SERIAL       PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(100) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role       VARCHAR(30)  NOT NULL DEFAULT 'employee',
    department VARCHAR(100),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);


-- ============================================================
-- TABLE: location
-- Referenced by: inventory_gen, office_furniture, it_supplies,
--                laptop (current_location)
-- ============================================================

CREATE TABLE location (
    location_id   SERIAL       PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE INDEX idx_location_name ON location(location_name);


-- ============================================================
-- TABLE: system_log
-- Source: routes/logs.js, utils/log.js
-- ============================================================

CREATE TABLE system_log (
    log_id         SERIAL       PRIMARY KEY,
    user_id        INTEGER      REFERENCES users(user_id) ON DELETE SET NULL,
    action_type    VARCHAR(50),
    module         VARCHAR(50),
    description    TEXT,
    quantity       INTEGER,
    movement_type  VARCHAR(30),
    reference_type VARCHAR(50),
    performed_by   VARCHAR(100),
    date_time      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_syslog_user_id    ON system_log(user_id);
CREATE INDEX idx_syslog_action     ON system_log(action_type);
CREATE INDEX idx_syslog_module     ON system_log(module);
CREATE INDEX idx_syslog_date_time  ON system_log(date_time DESC);


-- ============================================================
-- TABLE: inventory_gen
-- Source: routes/inventory.js
-- ============================================================

CREATE TABLE inventory_gen (
    inventory_gen_id SERIAL        PRIMARY KEY,
    item_name        VARCHAR(100)  NOT NULL,
    current_quantity INTEGER       NOT NULL DEFAULT 0,
    category         VARCHAR(50),
    reorder_level    INTEGER       NOT NULL DEFAULT 0,
    price            NUMERIC(12,2),
    unit             VARCHAR(30),
    remarks          VARCHAR(255),
    location_id      INTEGER       REFERENCES location(location_id) ON DELETE SET NULL,
    last_updated     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invgen_location_id ON inventory_gen(location_id);
CREATE INDEX idx_invgen_category    ON inventory_gen(category);


-- ============================================================
-- TABLE: purchase_orders
-- Source: routes/po.js
-- ============================================================

CREATE TABLE purchase_orders (
    purchase_order_id    SERIAL        PRIMARY KEY,
    item_id              INTEGER       REFERENCES inventory_gen(inventory_gen_id) ON DELETE SET NULL,
    quantity_ordered     INTEGER       NOT NULL DEFAULT 0,
    received_quantity    INTEGER       NOT NULL DEFAULT 0,
    order_date           DATE,
    expected_delivery_date DATE,
    actual_delivery_date   DATE,
    status               VARCHAR(20)   NOT NULL DEFAULT 'ORDERED',
    remarks              VARCHAR(255),
    unit                 VARCHAR(30),
    supplier_name        VARCHAR(100),
    supplier_contact     VARCHAR(100),
    unit_price           NUMERIC(12,2),
    performed_by         VARCHAR(100),
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_item_id ON purchase_orders(item_id);
CREATE INDEX idx_po_status  ON purchase_orders(status);


-- ============================================================
-- TABLE: office_furniture
-- Source: routes/furniture.js
-- ============================================================

CREATE TABLE office_furniture (
    office_furniture_id SERIAL        PRIMARY KEY,
    furniture_name      VARCHAR(100)  NOT NULL,
    quantity            INTEGER       NOT NULL DEFAULT 1,
    date_of_purchase    DATE,
    price               NUMERIC(12,2),
    remarks             VARCHAR(255),
    current_location    INTEGER       REFERENCES location(location_id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_furniture_location ON office_furniture(current_location);


-- ============================================================
-- TABLE: it_supplies
-- Source: routes/itSupplies.js
-- ============================================================

CREATE TABLE it_supplies (
    it_supplies_id   SERIAL        PRIMARY KEY,
    asset_name       VARCHAR(100)  NOT NULL,
    serial_number    VARCHAR(100),
    quantity         INTEGER       NOT NULL DEFAULT 1,
    date_of_purchase DATE,
    price            NUMERIC(12,2),
    warranty_end_date DATE,
    remarks          VARCHAR(255),
    location_id      INTEGER       REFERENCES location(location_id) ON DELETE SET NULL,
    status           VARCHAR(30),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_it_supplies_location_id ON it_supplies(location_id);
CREATE INDEX idx_it_supplies_status      ON it_supplies(status);
CREATE INDEX idx_it_supplies_warranty    ON it_supplies(warranty_end_date);


-- ============================================================
-- TABLE: laptop
-- Source: routes/laptops.js
-- ============================================================

CREATE TABLE laptop (
    laptop_id         SERIAL        PRIMARY KEY,
    asset_number      VARCHAR(50),
    item_description  VARCHAR(100)  NOT NULL,
    serial_number     VARCHAR(100),
    category          VARCHAR(50),
    price             NUMERIC(12,2),
    current_user_id   INTEGER       REFERENCES users(user_id) ON DELETE SET NULL,
    current_location  INTEGER       REFERENCES location(location_id) ON DELETE SET NULL,
    status            VARCHAR(30)   NOT NULL DEFAULT 'Active',
    warranty_end_date DATE,
    date_of_purchase  DATE,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_laptop_current_user_id  ON laptop(current_user_id);
CREATE INDEX idx_laptop_current_location ON laptop(current_location);
CREATE INDEX idx_laptop_status           ON laptop(status);


-- ============================================================
-- TABLE: laptop_history
-- Source: routes/laptops.js  (PUT /assign/:id)
-- ============================================================

CREATE TABLE laptop_history (
    history_id       SERIAL      PRIMARY KEY,
    laptop_id        INTEGER     NOT NULL REFERENCES laptop(laptop_id) ON DELETE CASCADE,
    previous_user_id INTEGER     REFERENCES users(user_id) ON DELETE SET NULL,
    new_user_id      INTEGER     REFERENCES users(user_id) ON DELETE SET NULL,
    date_changed     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remarks          TEXT
);

CREATE INDEX idx_laphist_laptop_id ON laptop_history(laptop_id);
CREATE INDEX idx_laphist_date      ON laptop_history(date_changed DESC);


-- ============================================================
-- TABLE: laptop_maintenance
-- Source: routes/laptopMaintenance.js
-- ============================================================

CREATE TABLE laptop_maintenance (
    maintenance_id   SERIAL      PRIMARY KEY,
    laptop_id        INTEGER     NOT NULL REFERENCES laptop(laptop_id) ON DELETE CASCADE,
    check_date       DATE        NOT NULL,
    condition        VARCHAR(30) NOT NULL,
    remarks          TEXT,
    user_id          INTEGER     REFERENCES users(user_id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lapmaint_laptop_id  ON laptop_maintenance(laptop_id);
CREATE INDEX idx_lapmaint_check_date ON laptop_maintenance(check_date DESC);


-- ============================================================
-- TABLE: vehicle
-- Source: routes/vehicle.js
-- ============================================================

CREATE TABLE vehicle (
    vehicle_id            SERIAL        PRIMARY KEY,
    vehicle_name          VARCHAR(100)  NOT NULL,
    plate_number          VARCHAR(30),
    type                  VARCHAR(30),
    purchase_date         DATE,
    status                VARCHAR(30)   NOT NULL DEFAULT 'ACTIVE',
    price                 NUMERIC(12,2),
    remarks               VARCHAR(255),
    odometer              INTEGER       NOT NULL DEFAULT 0,
    last_maintenance_km   INTEGER       NOT NULL DEFAULT 0,
    maintenance_threshold INTEGER       NOT NULL DEFAULT 1000,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicle_status ON vehicle(status);


-- ============================================================
-- TABLE: vehicle_maintenance
-- Source: routes/vehicle.js  (POST /maintenance)
-- ============================================================

CREATE TABLE vehicle_maintenance (
    vehicle_maintenance_id SERIAL        PRIMARY KEY,
    vehicle_id             INTEGER       NOT NULL REFERENCES vehicle(vehicle_id) ON DELETE CASCADE,
    service_type           VARCHAR(100)  NOT NULL,
    maintenance_date       DATE          NOT NULL,
    maintenance_cost       NUMERIC(12,2),
    odometer               INTEGER,
    remarks                TEXT,
    performed_by           VARCHAR(100),
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehmaint_vehicle_id       ON vehicle_maintenance(vehicle_id);
CREATE INDEX idx_vehmaint_maintenance_date ON vehicle_maintenance(maintenance_date DESC);


-- ============================================================
-- TABLE: vehicle_maintenance_types
-- Source: routes/vehicleMaintPlans.js
-- ============================================================

CREATE TABLE vehicle_maintenance_types (
    maint_type_id       SERIAL      PRIMARY KEY,
    vehicle_id          INTEGER     NOT NULL REFERENCES vehicle(vehicle_id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    basis               VARCHAR(20)  NOT NULL,
    threshold_km        INTEGER,
    last_maintenance_km INTEGER,
    interval_unit       VARCHAR(20),
    interval_value      INTEGER,
    last_performed_date DATE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehmainttype_vehicle_id ON vehicle_maintenance_types(vehicle_id);


-- ============================================================
-- TABLE: contracts
-- Source: routes/contracts.js
-- ============================================================

CREATE TABLE contracts (
    contract_id   SERIAL       PRIMARY KEY,
    contract_date DATE,
    other_party   VARCHAR(150) NOT NULL,
    description   TEXT,
    validity_type VARCHAR(10)  NOT NULL DEFAULT 'YEAR',
    valid_year    INTEGER,
    valid_from    DATE,
    valid_to      DATE,
    remarks       TEXT,
    status        VARCHAR(30)  NOT NULL DEFAULT 'IN_STORAGE',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_status ON contracts(status);


-- ============================================================
-- TABLE: contract_requests
-- Source: routes/contracts.js
-- ============================================================

CREATE TABLE contract_requests (
    request_id    SERIAL      PRIMARY KEY,
    contract_id   INTEGER     NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    requested_by  INTEGER     NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    request_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status        VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    approved_by   INTEGER     REFERENCES users(user_id) ON DELETE SET NULL,
    approved_date TIMESTAMPTZ
);

CREATE INDEX idx_conreq_contract_id ON contract_requests(contract_id);
CREATE INDEX idx_conreq_user_id     ON contract_requests(requested_by);
CREATE INDEX idx_conreq_status      ON contract_requests(status);


-- ============================================================
-- TABLE: globe_mobile_plan
-- Source: routes/globe.js
-- ============================================================

CREATE TABLE globe_mobile_plan (
    plan_id         SERIAL        PRIMARY KEY,
    user_id         INTEGER       REFERENCES users(user_id) ON DELETE SET NULL,
    mobile_number   VARCHAR(20)   NOT NULL,
    account_number  VARCHAR(50),
    plan_name       VARCHAR(100),
    data_allocation VARCHAR(50),
    monthly_cost    NUMERIC(12,2),
    credit_limit    NUMERIC(12,2),
    start_date      DATE,
    renewal_date    DATE,
    status          VARCHAR(30)   NOT NULL DEFAULT 'Active',
    remarks         VARCHAR(255),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_globe_user_id      ON globe_mobile_plan(user_id);
CREATE INDEX idx_globe_renewal_date ON globe_mobile_plan(renewal_date);
CREATE INDEX idx_globe_status       ON globe_mobile_plan(status);


-- ============================================================
-- TABLE: m365
-- Source: routes/m365.js
-- ============================================================

CREATE TABLE m365 (
    license_id       SERIAL        PRIMARY KEY,
    assigned_user_id INTEGER       REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_email   VARCHAR(150)  NOT NULL,
    license_type     VARCHAR(100),
    category         VARCHAR(50),
    license_cost     NUMERIC(12,2),
    monthly_cost     NUMERIC(12,2),
    start_date       DATE,
    expiry_date      DATE,
    renewal_date     DATE,
    status           VARCHAR(30)   NOT NULL DEFAULT 'Active',
    remarks          VARCHAR(255),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_m365_assigned_user_id ON m365(assigned_user_id);
CREATE INDEX idx_m365_expiry_date      ON m365(expiry_date);
CREATE INDEX idx_m365_status           ON m365(status);


-- ============================================================
-- TABLE: subscriptions
-- Source: routes/subscriptions.js
-- ============================================================

CREATE TABLE subscriptions (
    subscription_id   SERIAL        PRIMARY KEY,
    subscription_name VARCHAR(150)  NOT NULL,
    category          VARCHAR(50)   NOT NULL,
    supplier          VARCHAR(150),
    assigned_user_id  INTEGER       REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_to       VARCHAR(100),
    monthly_cost      NUMERIC(12,2),
    billing_cycle     VARCHAR(20)   NOT NULL DEFAULT 'monthly',
    start_date        DATE,
    expiry_date       DATE,
    status            VARCHAR(30)   NOT NULL DEFAULT 'Active',
    remarks           VARCHAR(255),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subs_assigned_user_id ON subscriptions(assigned_user_id);
CREATE INDEX idx_subs_expiry_date      ON subscriptions(expiry_date);
CREATE INDEX idx_subs_status           ON subscriptions(status);


-- ============================================================
-- TABLE: insurance
-- Source: routes/insurance.js
-- ============================================================

CREATE TABLE insurance (
    insurance_id  SERIAL       PRIMARY KEY,
    employee_name VARCHAR(150) NOT NULL,
    provider      VARCHAR(100),
    policy_number VARCHAR(100),
    start_date    DATE,
    expiry_date   DATE,
    remarks       VARCHAR(255),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insurance_expiry_date ON insurance(expiry_date);


-- ============================================================
-- TABLE: finance_documents
-- Source: routes/finance.js
-- ============================================================

CREATE TABLE finance_documents (
    finance_id    SERIAL       PRIMARY KEY,
    year          INTEGER      NOT NULL,
    folder_number INTEGER      NOT NULL,
    category      VARCHAR(100) NOT NULL,
    category_code VARCHAR(10),
    range_start   INTEGER      NOT NULL,
    range_end     INTEGER      NOT NULL,
    location      VARCHAR(30)  NOT NULL DEFAULT 'STORAGE',
    remarks       VARCHAR(255),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_findoc_year ON finance_documents(year);


-- ============================================================
-- TABLE: attachments
-- Source: routes/attachments.js
-- ============================================================

CREATE TABLE attachments (
    attachment_id SERIAL       PRIMARY KEY,
    module        VARCHAR(50)  NOT NULL,
    record_id     INTEGER      NOT NULL,
    file_name     VARCHAR(255) NOT NULL,
    file_url      TEXT         NOT NULL,
    file_type     VARCHAR(100),
    file_size_kb  INTEGER,
    uploaded_by   INTEGER      REFERENCES users(user_id) ON DELETE SET NULL,
    uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attach_module_record ON attachments(module, record_id);
CREATE INDEX idx_attach_uploaded_by   ON attachments(uploaded_by);


-- ============================================================
-- VIEW: v_subscriptions_master
-- Source: routes/subscriptionsMaster.js
-- Unifies globe_mobile_plan + m365 + subscriptions into
-- a single queryable surface for dashboard/reports.
-- ============================================================

CREATE VIEW v_subscriptions_master AS

    -- M365 Licenses
    SELECT
        'M365'                      AS source,
        m.license_id                AS source_id,
        COALESCE(u.name, m.assigned_email) AS assigned_to,
        m.assigned_email            AS contact,
        m.license_type              AS subscription_name,
        'Microsoft'                 AS supplier,
        COALESCE(m.monthly_cost, m.license_cost) AS monthly_cost,
        m.start_date,
        m.expiry_date,
        CASE
            WHEN m.status = 'Expired' THEN 'Expired'
            WHEN m.expiry_date IS NULL THEN COALESCE(m.status, 'Active')
            WHEN m.expiry_date < NOW()::DATE THEN 'Expired'
            WHEN m.expiry_date <= (NOW()::DATE + INTERVAL '30 days') THEN 'Expiring Soon'
            ELSE 'Active'
        END                         AS status
    FROM m365 m
    LEFT JOIN users u ON m.assigned_user_id = u.user_id

UNION ALL

    -- Globe Mobile Plans
    SELECT
        'Globe'                     AS source,
        g.plan_id                   AS source_id,
        COALESCE(u.name, g.mobile_number) AS assigned_to,
        g.mobile_number             AS contact,
        g.plan_name                 AS subscription_name,
        'Globe Telecom'             AS supplier,
        g.monthly_cost,
        g.start_date,
        g.renewal_date              AS expiry_date,
        CASE
            WHEN g.status = 'Inactive' THEN 'Inactive'
            WHEN g.renewal_date IS NULL THEN COALESCE(g.status, 'Active')
            WHEN g.renewal_date < NOW()::DATE THEN 'Inactive'
            WHEN g.renewal_date <= (NOW()::DATE + INTERVAL '30 days') THEN 'For Renewal'
            ELSE 'Active'
        END                         AS status
    FROM globe_mobile_plan g
    LEFT JOIN users u ON g.user_id = u.user_id

UNION ALL

    -- Other Subscriptions
    SELECT
        'Subscription'              AS source,
        s.subscription_id           AS source_id,
        COALESCE(u.name, s.assigned_to, 'Unassigned') AS assigned_to,
        s.assigned_to               AS contact,
        s.subscription_name,
        s.supplier,
        s.monthly_cost,
        s.start_date,
        s.expiry_date,
        CASE
            WHEN s.status = 'Cancelled' THEN 'Cancelled'
            WHEN s.expiry_date IS NULL THEN COALESCE(s.status, 'Active')
            WHEN s.expiry_date < NOW()::DATE THEN 'Expired'
            WHEN s.expiry_date <= (NOW()::DATE + INTERVAL '30 days') THEN 'Expiring Soon'
            ELSE COALESCE(s.status, 'Active')
        END                         AS status
    FROM subscriptions s
    LEFT JOIN users u ON s.assigned_user_id = u.user_id;


-- ============================================================
-- SEED DATA: locations (common office locations)
-- Update to match your actual locations before migrating.
-- ============================================================

INSERT INTO location (location_name) VALUES
    ('Events Supplies Shelf - Office'),
    ('Pantry Cabinet'),
    ('Hamburg - Office'),
    ('Munich - Office');



PORT=3000

API_URL=https://assetmanagementsystem-production-51d8.up.railway.app

const API_URL = "https://assetmanagementsystem-production-51d8.up.railway.app";