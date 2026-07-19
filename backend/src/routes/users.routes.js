import { Router } from "express";

import {
    addToHistory,
    getUserHistory,
    login,
    logout,
    refresh,
    register,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { authLimiter } from "../middlewares/rateLimit.middleware.js";
import {
    addToHistorySchema,
    loginSchema,
    refreshSchema,
    registerSchema,
} from "../validators/user.validators.js";

const router = Router();

// Public. Rate limited because these endpoints accept credentials and are
// the obvious target for brute-force and account-creation abuse.
router.post("/register", authLimiter, validateBody(registerSchema), register);
router.post("/login", authLimiter, validateBody(loginSchema), login);
router.post("/refresh", validateBody(refreshSchema), refresh);
router.post("/logout", validateBody(refreshSchema), logout);

// Authenticated — requireAuth populates req.user or rejects with 401.
router.post(
    "/add_to_activity",
    requireAuth,
    validateBody(addToHistorySchema),
    addToHistory
);
router.get("/get_all_activity", requireAuth, getUserHistory);

export default router;
