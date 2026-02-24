import express from 'express';
import { AuditLog } from '../models/index.js';

const router = express.Router();

// GET /api/audit/logs - Get audit logs
router.get('/logs', async (req, res) => {
  try {
    const {
      eventType,
      severity,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};
    
    if (eventType) query.eventType = eventType;
    if (severity) query.severity = severity;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('performedBy', 'firstName lastName role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: logs,
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

export default router;
