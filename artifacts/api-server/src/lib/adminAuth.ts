import session from "express-session";
import type { RequestHandler, Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    adminId?: number;
    adminUsername?: string;
    adminRole?: string;
  }
}

export const sessionMiddleware: RequestHandler = session({
  secret: process.env["SESSION_SECRET"] || "xpay-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // true في Render
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.adminId) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }
  next();
}