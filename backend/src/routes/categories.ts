import { Router, Request, Response, NextFunction } from "express";
import * as categoryService from "../services/categoryService";
import { AppError } from "../middleware/errorHandler";
import { requireObject, requireString, optionalString } from "../lib/validation";

const router = Router();

/** Extracts the authenticated user id from the request headers. */
function uid(req: Request): string {
  const id = req.headers["x-user-id"] as string | undefined;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
}

/** Parses and validates the `type` field for a category creation request. */
function parseCategoryType(value: unknown): "INCOME" | "EXPENSE" {
  if (value !== "INCOME" && value !== "EXPENSE") {
    throw new AppError(400, "type must be INCOME or EXPENSE");
  }
  return value;
}

/**
 * Lists the current user's categories, seeding Bloom's starter set on first
 * call for a user who has none yet.
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await categoryService.listCategories(uid(req)));
  } catch (err) {
    next(err);
  }
});

/** Creates a new custom category. */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const name = requireString(body.name, "name", { max: 40 });
    const type = parseCategoryType(body.type);
    const color = requireString(body.color, "color", { max: 7 });
    const icon = optionalString(body.icon, "icon", { max: 8 });
    res
      .status(201)
      .json(await categoryService.createCategory(uid(req), { name, type, color, icon }));
  } catch (err) {
    next(err);
  }
});

/** Renames a category or changes its color/icon. The category's type is fixed at creation. */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObject(req.body);
    const name = requireString(body.name, "name", { max: 40 });
    const color = requireString(body.color, "color", { max: 7 });
    const icon = optionalString(body.icon, "icon", { max: 8 });
    res.json(
      await categoryService.updateCategory(uid(req), req.params["id"] as string, {
        name,
        color,
        icon,
      })
    );
  } catch (err) {
    next(err);
  }
});

/** Deletes a category. Historical transactions/budgets keep their category name as plain text. */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await categoryService.deleteCategory(uid(req), req.params["id"] as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
