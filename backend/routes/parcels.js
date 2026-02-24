import express from 'express';
import { Parcel, Owner, OwnershipHistory } from '../models/index.js';

const router = express.Router();

// GET /api/parcels - Get all parcels with filtering
router.get('/', async (req, res) => {
  try {
    const {
      region,
      legalStatus,
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };
    
    if (region && region !== 'All Regions') query.region = region;
    if (legalStatus && legalStatus !== 'All Statuses') query.legalStatus = legalStatus;
    if (search) {
      query.$or = [
        { parcelId: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [parcels, total] = await Promise.all([
      Parcel.find(query)
        .populate('currentOwner', 'personalInfo corporateInfo')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Parcel.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: parcels,
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

// GET /api/parcels/:id - Get single parcel
router.get('/:id', async (req, res) => {
  try {
    const parcel = await Parcel.findById(req.params.id)
      .populate('currentOwner')
      .populate('verifiedBy', 'firstName lastName');

    if (!parcel) {
      return res.status(404).json({ success: false, message: 'Parcel not found' });
    }

    // Get ownership history
    const history = await OwnershipHistory.find({ parcel: parcel._id })
      .populate('newOwner', 'personalInfo corporateInfo')
      .populate('previousOwner', 'personalInfo corporateInfo')
      .sort({ transactionDate: -1 });

    res.json({
      success: true,
      data: {
        ...parcel.toObject(),
        ownershipHistory: history
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
