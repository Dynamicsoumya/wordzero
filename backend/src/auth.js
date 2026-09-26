import jwt from "jsonwebtoken";
import { sessionUser } from "./store.js";

const COOKIE = "wardzero_token";

function secret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is missing. Add it to backend/.env");
  return process.env.JWT_SECRET;
}

function cookieOptions(maxAge) {
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  if (maxAge) options.maxAge = maxAge;
  return options;
}

export function setAuthCookie(res, user, remember) {
  const token = jwt.sign({ sub: user.id }, secret(), { expiresIn: remember ? "7d" : "12h" });
  res.cookie(COOKIE, token, cookieOptions(remember ? 7 * 24 * 60 * 60 * 1000 : undefined));
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE, cookieOptions());
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: "Log in to continue." });
  try {
    const payload = jwt.verify(token, secret());
    const user = sessionUser(payload.sub);
    if (!user) return res.status(401).json({ error: "Log in to continue." });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Log in to continue." });
  }
}

export function requireApproved(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.status === "pending" || req.user.role === "pending") {
      return res.status(403).json({ error: "Wait for an admin to assign your role." });
    }
    return next();
  });
}

export function requireAdmin(req, res, next) {
  requireApproved(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Only an approved admin can do this." });
    return next();
  });
}

export function requireRole(...roles) {
  return (req, res, next) => {
    requireApproved(req, res, () => {
      if (!roles.includes(req.user.role)) return res.status(403).json({ error: "You do not have access to this action." });
      return next();
    });
  };
}
