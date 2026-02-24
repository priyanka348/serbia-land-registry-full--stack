import mongoose from 'mongoose';

const subsidySchema = new mongoose.Schema({
  // Subsidy Identification
  subsidyId: {
    type: String,
    required: true,
    unique: true,
    index: true
    // Format: SUB-2024-001234
  },
  
  // Program Information
  programName: {
    type: String,
    required: true,
    enum: [
      'First-Time Homebuyer',
      'Rural Development',
      'Low-Income Housing',
      'Veterans Housing',
      'Disability Housing',
      'Young Families',
      'Agricultural Land',
      'Energy Efficiency Retrofit'
    ]
  },
  
  programYear: {
    type: Number,
    required: true
  },
  
  // Beneficiary Information
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true,
    index: true
  },
  
  // Related Property
  parcel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parcel',
    required: true,
    index: true
  },
  
  // Financial Details
  allocatedAmount: {
    type: Number, // in EUR
    required: true
  },
  
  approvedAmount: {
    type: Number, // in EUR
    required: true
  },
  
  disbursedAmount: {
    type: Number, // in EUR
    default: 0
  },
  
  remainingAmount: {
    type: Number, // in EUR
    default: 0
  },
  
  // Dates
  applicationDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  approvalDate: Date,
  
  disbursementDate: Date,
  
  completionDate: Date,
  
  expiryDate: Date,
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'disbursed', 'completed', 'rejected', 'cancelled', 'expired'],
    default: 'pending',
    required: true,
    index: true
  },
  
  // Eligibility & Compliance
  eligibilityCriteria: [{
    criterion: String,
    met: Boolean,
    verifiedDate: Date
  }],
  
  isEligible: {
    type: Boolean,
    default: false
  },
  
  // Verification & Fraud Detection
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  verificationDate: Date,
  
  isLegitimate: {
    type: Boolean,
    default: true
  },
  
  fraudFlags: [{
    flagType: {
      type: String,
      enum: ['duplicate_application', 'false_documentation', 'income_misrepresentation', 'property_overvaluation', 'ineligible_beneficiary']
    },
    flagDate: Date,
    description: String,
    resolvedDate: Date,
    isResolved: Boolean
  }],
  
  // Disbursement History
  disbursements: [{
    amount: Number,
    disbursementDate: Date,
    method: {
      type: String,
      enum: ['bank_transfer', 'check', 'direct_payment']
    },
    referenceNumber: String,
    recipient: String
  }],
  
  // Documentation
  documents: [{
    documentType: {
      type: String,
      enum: ['application', 'income_proof', 'property_deed', 'eligibility_certificate', 'approval_letter', 'disbursement_receipt']
    },
    documentNumber: String,
    uploadDate: Date,
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    }
  }],
  
  // Conditions & Requirements
  conditions: [{
    condition: String,
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'met', 'overdue', 'waived'],
      default: 'pending'
    },
    completionDate: Date
  }],
  
  // Region
  region: {
    type: String,
    required: true,
    index: true
  },
  
  municipality: String,
  
  // Processing Information
  processingOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Performance Metrics
  utilizationRate: {
    type: Number, // percentage
    default: 0
  },
  
  processingTime: {
    type: Number, // in days
    default: 0
  },
  
  // Impact Tracking
  impact: {
    housingUnitsCreated: Number,
    jobsCreated: Number,
    economicImpact: Number,
    beneficiariesHelped: Number
  },
  
  // Notes
  notes: String,
  
  internalNotes: String,
  
  rejectionReason: String,
  
  cancellationReason: String

}, {
  timestamps: true
});

// Indexes
subsidySchema.index({ programName: 1, status: 1 });
subsidySchema.index({ region: 1, programYear: 1 });
subsidySchema.index({ beneficiary: 1 });
subsidySchema.index({ applicationDate: -1 });
subsidySchema.index({ isLegitimate: 1 });

// Pre-save hook to calculate derived fields
subsidySchema.pre('save', function(next) {
  // Calculate remaining amount
  this.remainingAmount = this.approvedAmount - this.disbursedAmount;
  
  // Calculate utilization rate
  if (this.approvedAmount > 0) {
    this.utilizationRate = (this.disbursedAmount / this.approvedAmount) * 100;
  }
  
  // Calculate processing time if approved
  if (this.approvalDate && this.applicationDate) {
    const diffTime = Math.abs(this.approvalDate - this.applicationDate);
    this.processingTime = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  next();
});

// Method to record disbursement
subsidySchema.methods.recordDisbursement = async function(amount, method, referenceNumber) {
  this.disbursements.push({
    amount,
    disbursementDate: new Date(),
    method,
    referenceNumber,
    recipient: 'Beneficiary'
  });
  
  this.disbursedAmount += amount;
  
  if (this.disbursedAmount >= this.approvedAmount) {
    this.status = 'completed';
    this.completionDate = new Date();
  } else {
    this.status = 'disbursed';
  }
  
  await this.save();
};

// Method to flag as fraudulent
subsidySchema.methods.flagAsFraud = async function(flagType, description) {
  this.fraudFlags.push({
    flagType,
    flagDate: new Date(),
    description,
    isResolved: false
  });
  
  this.isLegitimate = false;
  this.status = 'cancelled';
  
  await this.save();
};

// Static method to get program statistics
subsidySchema.statics.getProgramStats = async function(programName, year) {
  const stats = await this.aggregate([
    {
      $match: {
        programName: programName || { $exists: true },
        programYear: year || new Date().getFullYear()
      }
    },
    {
      $group: {
        _id: '$programName',
        totalAllocated: { $sum: '$allocatedAmount' },
        totalApproved: { $sum: '$approvedAmount' },
        totalDisbursed: { $sum: '$disbursedAmount' },
        count: { $sum: 1 },
        completedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        fraudCount: {
          $sum: { $cond: [{ $eq: ['$isLegitimate', false] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats;
};

const Subsidy = mongoose.model('Subsidy', subsidySchema);

export default Subsidy;
