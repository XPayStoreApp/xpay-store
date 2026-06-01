import session from "express-session";
import type { RequestHandler, Request, Response, NextFunction } from "express";

const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env["SESSION_SECRET"] || "";

if (isProduction && (!sessionSecret || sessionSecret === "xpay-dev-secret")) {
  throw new Error("SESSION_SECRET must be configured with a strong value in production.");
}

declare module "express-session" {
  interface SessionData {
    adminId?: number;
    adminUsername?: string;
    adminRole?: string;
  }
}

export const sessionMiddleware: RequestHandler = session({
  secret: sessionSecret || "xpay-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
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
