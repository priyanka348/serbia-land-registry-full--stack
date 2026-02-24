import express from 'express';
import { Owner } from '../models/index.js';

const router = express.Router();

// GET /api/owners - Get all owners
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { 'personalInfo.firstName': { $regex: search, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: search, $options: 'i' } },
        { 'corporateInfo.companyName': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [owners, total] = await Promise.all([
      Owner.find(query)
        .skip(skip)
        .limit(parseInt(limit)),
      Owner.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: owners,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/owners/:id - Get single owner
router.get('/:id', async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id);

    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }

    res.json({
      success: true,
      data: owner
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
