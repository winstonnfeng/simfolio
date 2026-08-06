import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../asyncHandler.js';
import { validateBody } from '../middleware/validate.js';

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function authRoutes({ registerUser, loginUser, users, authenticate }) {
  const router = Router();

  router.post(
    '/register',
    validateBody(registerSchema),
    asyncHandler(async (req, res) => res.status(201).json(await registerUser.execute(req.body)))
  );

  router.post(
    '/login',
    validateBody(loginSchema),
    asyncHandler(async (req, res) => res.json(await loginUser.execute(req.body)))
  );

  router.get(
    '/me',
    authenticate,
    asyncHandler(async (req, res) => {
      const user = await users.findById(req.userId);
      res.json({ user: { id: user.id, name: user.name, email: user.email } });
    })
  );

  return router;
}
