import express from 'express';
import { User } from '../models/index.js';

const router = express.Router();

// GET /api/users - Get all users
router.get('/', async (req, res) => {
  try {
    const { role } = req.query;
    const query = role ? { role } : {};

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
