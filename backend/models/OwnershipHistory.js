import mongoose from 'mongoose';

const ownershipHistorySchema = new mongoose.Schema({
  // References
  parcel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parcel',
    required: true,
    index: true
  },
  
  // Transaction Details
  transactionType: {
    type: String,
    enum: [
      'purchase',
      'sale',
      'inheritance',
      'gift',
      'expropriation',
      'court_order',
      'restitution',
      'merger',
      'division',
      'initial_registration',
      'correction'
    ],
    required: true
  },
  
  // Previous and New Owners
  previousOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner'
  },
  
  newOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },
  
  // Transaction Date
  transactionDate: {
    type: Date,
    required: true
  },
  
  registrationDate: {
    type: Date,
    default: Date.now
  },
  
  // Financial Details
  transactionValue: {
    type: Number, // in EUR
    default: 0
  },
  
  taxPaid: {
    type: Number, // in EUR
    default: 0
  },
  
  // Legal Basis
  legalBasis: {
    type: String,
    required: true,
    // e.g., "Purchase Contract #12345", "Court Decision #ABC/2023", "Inheritance Certificate"
  },
  
  contractNumber: String,
  
  notaryId: String,
  
  courtDecisionNumber: String,
  
  // Documentation
  documents: [{
    documentType: {
      type: String,
      enum: ['contract', 'deed', 'court_decision', 'certificate', 'permit', 'other']
    },
    documentNumber: String,
    issueDate: Date,
    issuingAuthority: String,
    fileUrl: String
  }],
  
  // Approval & Verification
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'under_review'],
    default: 'pending'
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvalDate: Date,
  
  approvalNotes: String,
  
  rejectionReason: String,
  
  // Blockchain Hash
  blockchainHash: {
    type: String,
    index: true
  },
  
  blockchainTimestamp: Date,
  
  // Audit Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  verificationDate: Date,
  
  // Flags
  isFraudulent: {
    type: Boolean,
    default: false
  },
  
  fraudDetectionDate: Date,
  
  fraudNotes: String,
  
  // Metadata
  notes: String,
  
  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Indexes for efficient queries
ownershipHistorySchema.index({ parcel: 1, transactionDate: -1 });
ownershipHistorySchema.index({ newOwner: 1 });
ownershipHistorySchema.index({ previousOwner: 1 });
ownershipHistorySchema.index({ transactionType: 1, status: 1 });
ownershipHistorySchema.index({ blockchainHash: 1 });

// Method to mark as fraudulent
ownershipHistorySchema.methods.markAsFraudulent = async function(reason) {
  this.isFraudulent = true;
  this.fraudDetectionDate = new Date();
  this.fraudNotes = reason;
  this.status = 'rejected';
  await this.save();
};

const OwnershipHistory = mongoose.model('OwnershipHistory', ownershipHistorySchema);

export default OwnershipHistory;
