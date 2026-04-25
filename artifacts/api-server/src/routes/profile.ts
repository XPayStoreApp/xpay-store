import { Router, type IRouter } from "express";
import { GetProfileResponse } from "@workspace/api-zod";
import { getOrCreateCurrentUser } from "../lib/currentUser.js";

const router: IRouter = Router();

router.get("/me", async (req, res) => {
  const u = await getOrCreateCurrentUser(req);
  const data = GetProfileResponse.parse({
    id: String(u.id),
    telegramId: u.telegramId,
    username: u.username,
    balanceUsd: Number(u.balanceUsd),
    balanceSyp: Number(u.balanceSyp),
    role: u.role,
  });
  res.json(data);
});

export default router;
