import mongoose from 'mongoose';

const transferSchema = new mongoose.Schema({
  // Transfer Identification
  transferId: {
    type: String,
    required: true,
    unique: true,
    index: true
    // Format: TRF-2024-001234
  },
  
  // Related Records
  parcel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parcel',
    required: true,
    index: true
  },
  
  ownershipHistory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OwnershipHistory'
  },
  
  // Parties
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },
  
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },
  
  // Transfer Details
  transferType: {
    type: String,
    enum: ['sale', 'gift', 'inheritance', 'exchange', 'expropriation', 'court_order', 'other'],
    required: true
  },
  
  transferStatus: {
    type: String,
    enum: ['initiated', 'pending_approval', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'initiated',
    required: true
  },
  
  // Financial Details
  agreedPrice: {
    type: Number, // in EUR
    required: true
  },
  
  registeredPrice: {
    type: Number, // in EUR (may differ for tax purposes)
    required: true
  },
  
  marketValue: {
    type: Number, // in EUR (official valuation)
  },
  
  // Taxes and Fees
  transferTax: {
    rate: {
      type: Number, // percentage
      default: 2.5
    },
    amount: Number // in EUR
  },
  
  registrationFee: {
    type: Number,
    default: 0
  },
  
  notaryFee: {
    type: Number,
    default: 0
  },
  
  totalFees: {
    type: Number,
    default: 0
  },
  
  // Payment Status
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid', 'refunded'],
    default: 'unpaid'
  },
  
  paymentDate: Date,
  
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'check', 'escrow', 'other']
  },
  
  // Legal Documentation
  contractDate: {
    type: Date,
    required: true
  },
  
  contractNumber: {
    type: String,
    required: true
  },
  
  notaryId: String,
  
  notaryName: String,
  
  notarizationDate: Date,
  
  // Registration
  applicationDate: {
    type: Date,
    default: Date.now
  },
  
  approvalDate: Date,
  
  registrationDate: Date,
  
  completionDate: Date,
  
  expectedCompletionDate: Date,
  
  // Processing Information
  processingStage: {
    type: String,
    enum: [
      'document_submission',
      'document_verification',
      'legal_review',
      'tax_assessment',
      'approval_pending',
      'registration',
      'completed'
    ],
    default: 'document_submission'
  },
  
  assignedOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Documents
  documents: [{
    documentType: {
      type: String,
      enum: [
        'purchase_contract',
        'seller_id',
        'buyer_id',
        'property_deed',
        'tax_clearance',
        'mortgage_clearance',
        'court_decision',
        'inheritance_certificate',
        'other'
      ]
    },
    documentNumber: String,
    uploadDate: Date,
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    fileUrl: String,
    notes: String
  }],
  
  // Conditions and Restrictions
  conditions: [{
    condition: String,
    status: {
      type: String,
      enum: ['pending', 'met', 'waived'],
      default: 'pending'
    },
    completionDate: Date
  }],
  
  // Encumbrances Check
  encumbrancesChecked: {
    type: Boolean,
    default: false
  },
  
  encumbrancesCleared: {
    type: Boolean,
    default: false
  },
  
  outstandingEncumbrances: [{
    type: String,
    description: String,
    amount: Number
  }],
  
  // Region Information
  region: {
    type: String,
    required: true
  },
  
  registryOffice: {
    type: String,
    required: true
  },
  
  // Blockchain
  blockchainHash: String,
  
  blockchainTimestamp: Date,
  
  // Rejection/Cancellation
  rejectionReason: String,
  
  rejectionDate: Date,
  
  cancellationReason: String,
  
  cancellationDate: Date,
  
  // Processing Timeline
  processingTime: {
    type: Number, // in days
    default: 0
  },
  
  // Flags
  isPriority: {
    type: Boolean,
    default: false
  },
  
  requiresAdditionalReview: {
    type: Boolean,
    default: false
  },
  
  isSuspicious: {
    type: Boolean,
    default: false
  },
  
  suspiciousFlags: [String],
  
  // Notes
  processingNotes: String,
  
  internalNotes: String,
  
  publicNotes: String,
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }

}, {
  timestamps: true
});

// Indexes
transferSchema.index({ transferStatus: 1, region: 1 });
transferSchema.index({ applicationDate: -1 });
transferSchema.index({ buyer: 1 });
transferSchema.index({ seller: 1 });
transferSchema.index({ processingStage: 1 });

// Pre-save hook to calculate total fees and processing time
transferSchema.pre('save', function(next) {
  // Calculate total fees
  this.totalFees = 
    (this.transferTax?.amount || 0) + 
    (this.registrationFee || 0) + 
    (this.notaryFee || 0);
  
  // Calculate processing time if completed
  if (this.completionDate && this.applicationDate) {
    const diffTime = Math.abs(this.completionDate - this.applicationDate);
    this.processingTime = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  next();
});

// Method to calculate tax amount
transferSchema.methods.calculateTransferTax = function() {
  if (this.transferTax && this.transferTax.rate && this.registeredPrice) {
    this.transferTax.amount = (this.registeredPrice * this.transferTax.rate) / 100;
  }
};

const Transfer = mongoose.model('Transfer', transferSchema);

export default Transfer;
