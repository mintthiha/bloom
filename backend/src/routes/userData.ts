import { Router, Request, Response, NextFunction } from "express";
import * as userDataService from "../services/userDataService";
import { AppError } from "../middleware/errorHandler";

const router = Router();

/** Extracts the authenticated user id from the request headers. */
function uid(req: Request): string {
  const id = req.headers["x-user-id"] as string | undefined;
  if (!id) throw new AppError(401, "Unauthorized");
  return id;
}

/** Returns every live row Bloom stores for the current user as one downloadable JSON bundle. */
router.get("/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await userDataService.exportUserData(uid(req)));
  } catch (err) {
    next(err);
  }
});

/** Permanently erases the current user's account and all of its data. */
router.delete("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await userDataService.deleteAllUserData(uid(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
