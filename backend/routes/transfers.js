import express from 'express';
import { Transfer } from '../models/index.js';

const router = express.Router();

// GET /api/transfers - Get all transfers
router.get('/', async (req, res) => {
  try {
    const {
      region,
      status,
      page = 1,
      limit = 20,
      sortBy = 'applicationDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (region && region !== 'All Regions') query.region = region;
    if (status) query.transferStatus = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [transfers, total] = await Promise.all([
      Transfer.find(query)
        .populate('parcel', 'parcelId region address')
        .populate('seller', 'personalInfo corporateInfo')
        .populate('buyer', 'personalInfo corporateInfo')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Transfer.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: transfers,
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

// GET /api/transfers/:id - Get single transfer
router.get('/:id', async (req, res) => {
  try {
    const transfer = await Transfer.findById(req.params.id)
      .populate('parcel')
      .populate('seller')
      .populate('buyer')
      .populate('assignedOfficer', 'firstName lastName');

    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    res.json({
      success: true,
      data: transfer
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
