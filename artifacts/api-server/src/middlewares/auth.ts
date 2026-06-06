import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = req.session as { authenticated?: boolean } | undefined;
  if (!session?.authenticated) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
