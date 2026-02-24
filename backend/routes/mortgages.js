import express from 'express';
import { Mortgage } from '../models/index.js';

const router = express.Router();

// GET /api/mortgages - Get all mortgages
router.get('/', async (req, res) => {
  try {
    const {
      region,
      status,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};
    
    if (region && region !== 'All Regions') query.region = region;
    if (status) query.mortgageStatus = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [mortgages, total] = await Promise.all([
      Mortgage.find(query)
        .populate('parcel', 'parcelId region address')
        .populate('borrower', 'personalInfo corporateInfo')
        .sort({ originationDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Mortgage.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: mortgages,
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

// GET /api/mortgages/:id - Get single mortgage
router.get('/:id', async (req, res) => {
  try {
    const mortgage = await Mortgage.findById(req.params.id)
      .populate('parcel')
      .populate('borrower');

    if (!mortgage) {
      return res.status(404).json({ success: false, message: 'Mortgage not found' });
    }

    res.json({
      success: true,
      data: mortgage
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
