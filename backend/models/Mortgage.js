import mongoose from 'mongoose';

const mortgageSchema = new mongoose.Schema({
  // Mortgage Identification
  mortgageId: {
    type: String,
    required: true,
    unique: true,
    index: true
    // Format: MTG-2024-001234
  },
  
  // Related Records
  parcel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parcel',
    required: true,
    index: true
  },
  
  borrower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },
  
  // Lender Information
  lender: {
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['bank', 'credit_union', 'private_lender', 'government', 'other'],
      required: true
    },
    registrationNumber: String,
    contact: {
      email: String,
      phone: String,
      address: String
    }
  },
  
  // Mortgage Details
  mortgageType: {
    type: String,
    enum: ['residential', 'commercial', 'agricultural', 'construction', 'refinance'],
    required: true
  },
  
  mortgageStatus: {
    type: String,
    enum: ['active', 'paid_off', 'defaulted', 'foreclosed', 'suspended', 'cancelled'],
    default: 'active',
    required: true
  },
  
  // Financial Terms
  principalAmount: {
    type: Number, // in EUR
    required: true
  },
  
  outstandingBalance: {
    type: Number, // in EUR
    required: true
  },
  
  interestRate: {
    type: Number, // percentage
    required: true
  },
  
  interestType: {
    type: String,
    enum: ['fixed', 'variable', 'mixed'],
    default: 'fixed'
  },
  
  term: {
    years: Number,
    months: Number
  },
  
  monthlyPayment: {
    type: Number, // in EUR
    required: true
  },
  
  // Dates
  originationDate: {
    type: Date,
    required: true
  },
  
  maturityDate: {
    type: Date,
    required: true
  },
  
  registrationDate: {
    type: Date,
    default: Date.now
  },
  
  lastPaymentDate: Date,
  
  nextPaymentDueDate: Date,
  
  // Payment History
  payments: [{
    paymentDate: Date,
    amount: Number,
    principal: Number,
    interest: Number,
    lateFee: Number,
    paymentMethod: String,
    receiptNumber: String
  }],
  
  totalPaid: {
    type: Number,
    default: 0
  },
  
  totalInterestPaid: {
    type: Number,
    default: 0
  },
  
  // Payment Status
  isCurrentOnPayments: {
    type: Boolean,
    default: true
  },
  
  daysPastDue: {
    type: Number,
    default: 0
  },
  
  missedPayments: {
    type: Number,
    default: 0
  },
  
  // Default Information
  defaultDate: Date,
  
  defaultReason: String,
  
  recoveryActions: [{
    actionType: {
      type: String,
      enum: ['notice', 'legal_action', 'foreclosure_initiated', 'property_seized']
    },
    actionDate: Date,
    description: String,
    outcome: String
  }],
  
  // Property Valuation
  propertyValueAtOrigination: {
    type: Number, // in EUR
    required: true
  },
  
  currentPropertyValue: Number,
  
  loanToValueRatio: {
    type: Number, // percentage
    required: true
  },
  
  // Collateral
  collateralDescription: String,
  
  additionalCollateral: [{
    description: String,
    estimatedValue: Number
  }],
  
  // Insurance
  insuranceRequired: {
    type: Boolean,
    default: true
  },
  
  insuranceProvider: String,
  
  insurancePolicyNumber: String,
  
  insuranceExpiryDate: Date,
  
  // Co-borrowers
  coBorrowers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner'
  }],
  
  // Guarantors
  guarantors: [{
    name: String,
    nationalId: String,
    guaranteeAmount: Number,
    guaranteeDate: Date
  }],
  
  // Legal Documentation
  mortgageDeedNumber: {
    type: String,
    required: true
  },
  
  notaryId: String,
  
  registrationNumber: String,
  
  legalDocuments: [{
    documentType: String,
    documentNumber: String,
    issueDate: Date,
    fileUrl: String
  }],
  
  // Special Conditions
  specialConditions: [{
    condition: String,
    status: String
  }],
  
  prepaymentAllowed: {
    type: Boolean,
    default: true
  },
  
  prepaymentPenalty: {
    type: Number,
    default: 0
  },
  
  // Region
  region: {
    type: String,
    required: true
  },
  
  registryOffice: String,
  
  // Subordination
  priority: {
    type: Number, // 1 = first mortgage, 2 = second, etc.
    default: 1
  },
  
  subordinateMortgages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mortgage'
  }],
  
  // Blockchain
  blockchainHash: String,
  
  blockchainTimestamp: Date,
  
  // Risk Assessment
  riskRating: {
    type: String,
    enum: ['low', 'medium', 'high', 'very_high'],
    default: 'low'
  },
  
  riskFactors: [String],
  
  // Flags
  isUnderReview: {
    type: Boolean,
    default: false
  },
  
  requiresAction: {
    type: Boolean,
    default: false
  },
  
  // Notes
  notes: String,
  
  internalNotes: String,
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lastReviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  lastReviewDate: Date

}, {
  timestamps: true
});

// Indexes
mortgageSchema.index({ mortgageStatus: 1 });
mortgageSchema.index({ borrower: 1 });
mortgageSchema.index({ 'lender.name': 1 });
mortgageSchema.index({ region: 1, mortgageStatus: 1 });
mortgageSchema.index({ nextPaymentDueDate: 1 });

// Virtual for remaining term
mortgageSchema.virtual('remainingMonths').get(function() {
  if (!this.maturityDate) return 0;
  const now = new Date();
  const diff = this.maturityDate - now;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 30)));
});

// Method to calculate payment status
mortgageSchema.methods.updatePaymentStatus = function() {
  if (!this.nextPaymentDueDate) return;
  
  const now = new Date();
  const diffTime = now - this.nextPaymentDueDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    this.isCurrentOnPayments = false;
    this.daysPastDue = diffDays;
  } else {
    this.isCurrentOnPayments = true;
    this.daysPastDue = 0;
  }
};

// Method to record payment
mortgageSchema.methods.recordPayment = async function(paymentData) {
  this.payments.push(paymentData);
  this.outstandingBalance -= paymentData.principal;
  this.totalPaid += paymentData.amount;
  this.totalInterestPaid += paymentData.interest;
  this.lastPaymentDate = paymentData.paymentDate;
  
  // Calculate next payment due date
  const nextDue = new Date(paymentData.paymentDate);
  nextDue.setMonth(nextDue.getMonth() + 1);
  this.nextPaymentDueDate = nextDue;
  
  this.updatePaymentStatus();
  
  await this.save();
};

const Mortgage = mongoose.model('Mortgage', mortgageSchema);

export default Mortgage;
