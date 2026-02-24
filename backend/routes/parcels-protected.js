import express from 'express';
import { Parcel, Owner, OwnershipHistory } from '../models/index.js';
import { authenticate, authorize, checkPermission } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @route   GET /api/parcels
 * @desc    Get all parcels with filtering
 * @access  Private (any authenticated user)
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
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
  
  // Filter by region (respect user's assigned regions)
  if (region && region !== 'All Regions') {
    query.region = region;
  } else if (!['admin', 'minister'].includes(req.user.role)) {
    // Non-admin users can only see their assigned regions
    query.region = { $in: req.user.assignedRegions };
  }
  
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
}));

/**
 * @route   GET /api/parcels/:id
 * @desc    Get single parcel
 * @access  Private (any authenticated user)
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const parcel = await Parcel.findById(req.params.id)
    .populate('currentOwner')
    .populate('verifiedBy', 'firstName lastName');

  if (!parcel) {
    return res.status(404).json({ 
      success: false, 
      message: 'Parcel not found' 
    });
  }

  // Check region access
  if (!['admin', 'minister'].includes(req.user.role)) {
    if (!req.user.assignedRegions.includes(parcel.region)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this region'
      });
    }
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
}));

/**
 * @route   POST /api/parcels
 * @desc    Create new parcel
 * @access  Private (registrar or admin only)
 */
router.post(
  '/',
  authenticate,
  authorize('admin', 'registrar'),
  checkPermission('create_parcel'),
  asyncHandler(async (req, res) => {
    const parcelData = {
      ...req.body,
      verifiedBy: req.user._id
    };

    const parcel = await Parcel.create(parcelData);

    res.status(201).json({
      success: true,
      message: 'Parcel created successfully',
      data: parcel
    });
  })
);

/**
 * @route   PUT /api/parcels/:id
 * @desc    Update parcel
 * @access  Private (registrar or admin only)
 */
router.put(
  '/:id',
  authenticate,
  authorize('admin', 'registrar'),
  checkPermission('edit_parcel'),
  asyncHandler(async (req, res) => {
    const parcel = await Parcel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastModified: new Date() },
      { new: true, runValidators: true }
    );

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: 'Parcel not found'
      });
    }

    res.json({
      success: true,
      message: 'Parcel updated successfully',
      data: parcel
    });
  })
);

/**
 * @route   DELETE /api/parcels/:id
 * @desc    Delete (deactivate) parcel
 * @access  Private (admin only)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  checkPermission('delete_parcel'),
  asyncHandler(async (req, res) => {
    const parcel = await Parcel.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: 'Parcel not found'
      });
    }

    res.json({
      success: true,
      message: 'Parcel deleted successfully'
    });
  })
);

export default router;
