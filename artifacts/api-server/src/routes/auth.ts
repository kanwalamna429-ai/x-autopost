import { Router, type IRouter } from "express";
import { LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (!DASHBOARD_PASSWORD || parsed.data.password !== DASHBOARD_PASSWORD) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  (req.session as { authenticated?: boolean }).authenticated = true;
  res.json({ authenticated: true });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ authenticated: false });
  });
});

router.get("/auth/status", async (req, res): Promise<void> => {
  const session = req.session as { authenticated?: boolean };
  res.json({ authenticated: session.authenticated === true });
});

export default router;
