ALTER TABLE "User"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
ALTER COLUMN "role" TYPE "UserRole"
USING (
    CASE
        WHEN "role"::text IN ('ADMIN', 'ANALYST') THEN 'ADMIN'::"UserRole"
        ELSE 'USER'::"UserRole"
    END
);

ALTER TABLE "User"
ALTER COLUMN "role" SET DEFAULT 'USER';

DROP TYPE "UserRole_old";

ALTER TABLE "RestaurantUser"
ALTER COLUMN "permission" DROP DEFAULT;

ALTER TABLE "RestaurantUser"
DROP COLUMN "permission";

DROP TYPE "RestaurantPermission";
