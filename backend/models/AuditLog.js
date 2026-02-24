import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  // Event Identification
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
    // Format: AUD-2024-001234567
  },
  
  // Event Details
  eventType: {
    type: String,
    enum: [
      'parcel_created',
      'parcel_updated',
      'parcel_deleted',
      'ownership_transferred',
      'transfer_approved',
      'transfer_rejected',
      'dispute_filed',
      'dispute_resolved',
      'mortgage_created',
      'mortgage_updated',
      'payment_recorded',
      'user_login',
      'user_logout',
      'user_created',
      'user_updated',
      'permission_changed',
      'fraud_detected',
      'blockchain_recorded',
      'report_generated',
      'document_uploaded',
      'document_verified',
      'system_configuration',
      'data_export',
      'data_import',
      'backup_created',
      'other'
    ],
    required: true,
    index: true
  },
  
  action: {
    type: String,
    required: true
    // e.g., "Created new parcel RS-BG-001234"
  },
  
  // Actor (Who performed the action)
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  userRole: {
    type: String,
    required: true
  },
  
  // Target (What was affected)
  targetModel: {
    type: String,
    enum: ['Parcel', 'Owner', 'OwnershipHistory', 'Transfer', 'Dispute', 'Mortgage', 'User', 'System'],
    required: true
  },
  
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  targetDescription: String,
  
  // Changes Made
  changes: {
    before: mongoose.Schema.Types.Mixed, // State before change
    after: mongoose.Schema.Types.Mixed   // State after change
  },
  
  fieldsChanged: [String],
  
  // Request Details
  ipAddress: {
    type: String,
    required: true
  },
  
  userAgent: String,
  
  sessionId: String,
  
  // Location & Context
  region: String,
  
  office: String,
  
  // Outcome
  status: {
    type: String,
    enum: ['success', 'failure', 'partial', 'warning'],
    required: true,
    default: 'success'
  },
  
  errorMessage: String,
  
  // Severity
  severity: {
    type: String,
    enum: ['info', 'low', 'medium', 'high', 'critical'],
    default: 'info',
    index: true
  },
  
  // Blockchain Reference
  blockchainHash: String,
  
  blockchainTimestamp: Date,
  
  // Compliance & Legal
  legalBasis: String,
  
  complianceFlag: {
    type: Boolean,
    default: false
  },
  
  complianceNotes: String,
  
  // Risk Assessment
  riskLevel: {
    type: String,
    enum: ['none', 'low', 'medium', 'high'],
    default: 'none'
  },
  
  fraudIndicator: {
    type: Boolean,
    default: false
  },
  
  suspiciousActivity: {
    type: Boolean,
    default: false
  },
  
  alertGenerated: {
    type: Boolean,
    default: false
  },
  
  // Related Events
  relatedEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AuditLog'
  }],
  
  parentEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AuditLog'
  },
  
  // Timing
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  
  processingTime: {
    type: Number, // in milliseconds
    default: 0
  },
  
  // Additional Context
  metadata: mongoose.Schema.Types.Mixed,
  
  requestBody: mongoose.Schema.Types.Mixed,
  
  responseData: mongoose.Schema.Types.Mixed,
  
  // Review & Investigation
  isReviewed: {
    type: Boolean,
    default: false
  },
  
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  reviewDate: Date,
  
  reviewNotes: String,
  
  requiresInvestigation: {
    type: Boolean,
    default: false
  },
  
  investigationStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'dismissed']
  },
  
  // Retention Policy
  retentionPeriod: {
    type: Number, // in days
    default: 2555 // ~7 years (legal requirement for land records)
  },
  
  expiryDate: Date,
  
  isArchived: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: false // Using custom timestamp field
});

// Indexes for efficient querying
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });
auditLogSchema.index({ targetModel: 1, targetId: 1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ fraudIndicator: 1 });
auditLogSchema.index({ region: 1, timestamp: -1 });

// Compound indexes for common queries
auditLogSchema.index({ eventType: 1, region: 1, timestamp: -1 });
auditLogSchema.index({ performedBy: 1, eventType: 1, timestamp: -1 });

// Pre-save hook to set expiry date
auditLogSchema.pre('save', function(next) {
  if (!this.expiryDate && this.retentionPeriod) {
    this.expiryDate = new Date(this.timestamp.getTime() + (this.retentionPeriod * 24 * 60 * 60 * 1000));
  }
  next();
});

// Static method to create audit log
auditLogSchema.statics.logEvent = async function(eventData) {
  try {
    // Generate unique event ID
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const eventId = `AUD-${new Date().getFullYear()}-${timestamp}${random}`;
    
    const auditEntry = new this({
      eventId,
      ...eventData,
      timestamp: new Date()
    });
    
    await auditEntry.save();
    return auditEntry;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging should not break main operations
    return null;
  }
};

// Static method to query logs by date range
auditLogSchema.statics.findByDateRange = function(startDate, endDate, filters = {}) {
  const query = {
    timestamp: {
      $gte: startDate,
      $lte: endDate
    },
    ...filters
  };
  
  return this.find(query).sort({ timestamp: -1 });
};

// Static method to find suspicious activities
auditLogSchema.statics.findSuspicious = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    timestamp: { $gte: startDate },
    $or: [
      { suspiciousActivity: true },
      { fraudIndicator: true },
      { severity: 'critical' }
    ]
  }).sort({ timestamp: -1 });
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
