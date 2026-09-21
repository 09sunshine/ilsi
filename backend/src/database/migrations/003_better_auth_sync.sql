-- 003_better_auth_sync.sql: Synchronize Better Auth "user" table with application "users" table

-- 1. Sync from Better Auth "user" to LMS "users"
CREATE OR REPLACE FUNCTION sync_user_to_users()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    INSERT INTO users (
        id, name, email, email_verified, image, role, status, first_login, locale, created_at, updated_at
    ) VALUES (
        NEW.id,
        NEW.name,
        NEW.email,
        COALESCE(NEW."emailVerified", FALSE),
        NEW.image,
        COALESCE(NEW.role, 'PARTICIPANT'),
        COALESCE(NEW.status, 'ACTIVE'),
        COALESCE(NEW."firstLogin", TRUE),
        COALESCE(NEW.locale, 'en'),
        COALESCE(NEW."createdAt", NOW()),
        COALESCE(NEW."updatedAt", NOW())
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        email_verified = EXCLUDED.email_verified,
        image = EXCLUDED.image,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        first_login = EXCLUDED.first_login,
        locale = EXCLUDED.locale,
        updated_at = EXCLUDED.updated_at;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_to_users ON "user";
CREATE TRIGGER trg_sync_user_to_users
AFTER INSERT OR UPDATE ON "user"
FOR EACH ROW
EXECUTE FUNCTION sync_user_to_users();

-- 2. Reverse sync from LMS "users" to Better Auth "user" (e.g. role promotions, password/locale updates)
CREATE OR REPLACE FUNCTION sync_users_to_user()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    UPDATE "user" SET
        name = NEW.name,
        email = NEW.email,
        "emailVerified" = NEW.email_verified,
        image = NEW.image,
        role = NEW.role,
        status = NEW.status,
        "firstLogin" = NEW.first_login,
        locale = NEW.locale,
        "updatedAt" = NEW.updated_at
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_users_to_user ON users;
CREATE TRIGGER trg_sync_users_to_user
AFTER UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION sync_users_to_user();

-- 3. Backfill any existing records
INSERT INTO users (id, name, email, email_verified, image, role, status, first_login, locale, created_at, updated_at)
SELECT id, name, email, "emailVerified", image, role, status, "firstLogin", locale, "createdAt", "updatedAt"
FROM "user"
ON CONFLICT (id) DO NOTHING;
