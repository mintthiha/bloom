import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import prisma from "../lib/prisma";
import { logActivity } from "./activityService";
import {
  ActivityFieldChange,
  describeActivityFieldChanges,
  pushActivityFieldChange,
} from "./activityChanges";
import { DEFAULT_CATEGORIES } from "./defaultCategories";

export type CategoryType = "INCOME" | "EXPENSE";

type CategoryRecord = {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryInput = {
  name: string;
  type: CategoryType;
  color: string;
  icon?: string | null;
};

export type CategoryUpdateInput = {
  name: string;
  color: string;
  icon?: string | null;
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MAX_CATEGORY_NAME_LENGTH = 40;
const MAX_ICON_LENGTH = 8;

/** Normalizes a category row's dates aside — the shape is already API-safe. */
function normalizeCategory(row: CategoryRecord) {
  return row;
}

/**
 * Validates a category's editable fields (name, color, icon), shared by create
 * and update since both accept the same shape.
 */
function validateCategoryFields(name: string, color: string, icon?: string | null) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new AppError(400, "name is required");
  }
  if (trimmedName.length > MAX_CATEGORY_NAME_LENGTH) {
    throw new AppError(400, `name must be at most ${MAX_CATEGORY_NAME_LENGTH} characters`);
  }
  if (!HEX_COLOR_PATTERN.test(color)) {
    throw new AppError(400, "color must be a hex value like #22c55e");
  }
  const trimmedIcon = icon?.trim() || null;
  if (trimmedIcon && trimmedIcon.length > MAX_ICON_LENGTH) {
    throw new AppError(400, `icon must be at most ${MAX_ICON_LENGTH} characters`);
  }
  return { name: trimmedName, icon: trimmedIcon };
}

/** Throws 409 when another of the user's categories already uses this name (case-insensitive). */
async function assertNameAvailable(userId: string, name: string, excludingId?: string) {
  const exclusion = excludingId ? Prisma.sql`AND "id" != ${excludingId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "Category"
    WHERE "userId" = ${userId} AND LOWER("name") = LOWER(${name})
      ${exclusion}
    LIMIT 1
  `);
  if (rows[0]) {
    throw new AppError(409, `A category named "${name}" already exists`);
  }
}

/** Inserts the starter category set for a user who has none yet. */
async function seedDefaultCategories(userId: string) {
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.$queryRaw`
      INSERT INTO "Category" ("id", "userId", "name", "type", "color", "icon", "createdAt", "updatedAt")
      VALUES (
        ${randomUUID()}, ${userId}, ${category.name}, ${category.type}::"CategoryType",
        ${category.color}, ${category.icon}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("userId", "name") DO NOTHING
    `;
  }
}

/**
 * Lists a user's categories, seeding Bloom's starter set the first time this is
 * called for a user with none yet. Sorted expense-then-income, then name.
 */
export async function listCategories(userId: string) {
  const existing = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count" FROM "Category" WHERE "userId" = ${userId}
  `;
  if (Number(existing[0]?.count ?? 0) === 0) {
    await seedDefaultCategories(userId);
  }

  const rows = await prisma.$queryRaw<CategoryRecord[]>`
    SELECT "id", "userId", "name", "type"::text AS "type", "color", "icon", "createdAt", "updatedAt"
    FROM "Category"
    WHERE "userId" = ${userId}
    ORDER BY "type" ASC, "name" ASC
  `;
  return rows.map(normalizeCategory);
}

/** Creates a new category. Names are unique per user regardless of case. */
export async function createCategory(userId: string, input: CategoryInput) {
  const { name, icon } = validateCategoryFields(input.name, input.color, input.icon);
  if (input.type !== "INCOME" && input.type !== "EXPENSE") {
    throw new AppError(400, "type must be INCOME or EXPENSE");
  }
  await assertNameAvailable(userId, name);

  const id = randomUUID();
  const rows = await prisma.$queryRaw<CategoryRecord[]>`
    INSERT INTO "Category" ("id", "userId", "name", "type", "color", "icon", "createdAt", "updatedAt")
    VALUES (
      ${id}, ${userId}, ${name}, ${input.type}::"CategoryType", ${input.color}, ${icon},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id", "userId", "name", "type"::text AS "type", "color", "icon", "createdAt", "updatedAt"
  `;
  const category = normalizeCategory(rows[0]!);

  logActivity(userId, "CATEGORY_CREATED", `Created category "${category.name}"`, {
    categoryId: category.id,
    name: category.name,
    type: category.type,
  });

  return category;
}

/** Fetches one of the user's categories by id, or throws 404. */
async function getOwnedCategory(userId: string, id: string): Promise<CategoryRecord> {
  const rows = await prisma.$queryRaw<CategoryRecord[]>`
    SELECT "id", "userId", "name", "type"::text AS "type", "color", "icon", "createdAt", "updatedAt"
    FROM "Category"
    WHERE "id" = ${id} AND "userId" = ${userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new AppError(404, `Category ${id} not found`);
  }
  return row;
}

/** Renames a category and/or changes its color or icon. Type cannot change after creation. */
export async function updateCategory(userId: string, id: string, input: CategoryUpdateInput) {
  const existing = await getOwnedCategory(userId, id);
  const { name, icon } = validateCategoryFields(input.name, input.color, input.icon);
  if (name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertNameAvailable(userId, name, id);
  }

  const rows = await prisma.$queryRaw<CategoryRecord[]>`
    UPDATE "Category"
    SET "name" = ${name}, "color" = ${input.color}, "icon" = ${icon}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND "userId" = ${userId}
    RETURNING "id", "userId", "name", "type"::text AS "type", "color", "icon", "createdAt", "updatedAt"
  `;
  const category = normalizeCategory(rows[0]!);

  const changes: ActivityFieldChange[] = [];
  pushActivityFieldChange(changes, "name", "Name", "text", existing.name, category.name);
  pushActivityFieldChange(changes, "color", "Color", "text", existing.color, category.color);
  pushActivityFieldChange(changes, "icon", "Icon", "text", existing.icon, category.icon);

  if (changes.length > 0) {
    logActivity(
      userId,
      "CATEGORY_UPDATED",
      `Updated category "${existing.name}": ${describeActivityFieldChanges(changes, "no changes")}`,
      { categoryId: category.id, changes }
    );
  }

  return category;
}

/**
 * Deletes a category outright — safe because category names are stored as plain
 * strings elsewhere (transactions, budgets, recurring rules), not a foreign key,
 * so removing the reference row never touches historical data.
 */
export async function deleteCategory(userId: string, id: string) {
  const existing = await getOwnedCategory(userId, id);

  await prisma.$queryRaw`
    DELETE FROM "Category" WHERE "id" = ${id} AND "userId" = ${userId}
  `;

  logActivity(userId, "CATEGORY_DELETED", `Deleted category "${existing.name}"`, {
    categoryId: existing.id,
    name: existing.name,
  });
}
