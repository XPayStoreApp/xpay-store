import { Router, type IRouter } from "express";
import { GetProfileResponse } from "@workspace/api-zod";
import { getOrCreateCurrentUser } from "../lib/currentUser.js";

const router: IRouter = Router();

router.get("/me", async (req, res) => {
  try {
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
  } catch (error: any) {
    res.status(200).json({
      id: "0",
      telegramId: "",
      username: "Telegram User",
      balanceUsd: 0,
      balanceSyp: 0,
      role: "user",
      identityMissing: true,
      error: error?.message || "telegram_identity_missing",
    });
  }
});

export default router;
