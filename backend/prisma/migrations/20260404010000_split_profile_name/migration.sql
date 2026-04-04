ALTER TABLE "Profile" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Profile" ADD COLUMN "lastName" TEXT;

UPDATE "Profile"
SET
  "firstName" = split_part(trim("fullName"), ' ', 1),
  "lastName" = CASE
    WHEN strpos(trim("fullName"), ' ') > 0
      THEN trim(substr(trim("fullName"), strpos(trim("fullName"), ' ') + 1))
    ELSE ''
  END;

UPDATE "Profile"
SET "lastName" = ' '
WHERE "lastName" = '';

ALTER TABLE "Profile" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "Profile" ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "Profile" DROP COLUMN "fullName";
