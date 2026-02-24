import mongoose from 'mongoose';

const disputeSchema = new mongoose.Schema({
  // Dispute Identification
  disputeId: {
    type: String,
    required: true,
    unique: true,
    index: true
    // Format: DSP-2024-001234
  },
  
  // Related Parcel
  parcel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parcel',
    required: true,
    index: true
  },
  
  // Parties Involved
  claimant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },
  
  defendant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },
  
  otherParties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner'
  }],
  
  // Dispute Details
  disputeType: {
    type: String,
    enum: [
      'ownership_claim',
      'boundary_dispute',
      'inheritance_dispute',
      'fraud_allegation',
      'contract_breach',
      'zoning_violation',
      'easement_dispute',
      'mortgage_dispute',
      'registration_error',
      'other'
    ],
    required: true
  },
  
  description: {
    type: String,
    required: true
  },
  
  claimedAmount: {
    type: Number, // in EUR
    default: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ['Open', 'Investigation', 'Court', 'Resolved', 'Withdrawn', 'Dismissed'],
    default: 'Open',
    required: true
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Timeline
  filingDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  investigationStartDate: Date,
  
  courtFilingDate: Date,
  
  resolutionDate: Date,
  
  expectedResolutionDate: Date,
  
  // Court Information
  courtName: String,
  
  caseNumber: String,
  
  judge: String,
  
  hearingDates: [{
    date: Date,
    outcome: String,
    notes: String
  }],
  
  // Legal Representation
  claimantLawyer: {
    name: String,
    barNumber: String,
    contact: String
  },
  
  defendantLawyer: {
    name: String,
    barNumber: String,
    contact: String
  },
  
  // Evidence & Documentation
  evidence: [{
    type: {
      type: String,
      enum: ['document', 'witness', 'expert_opinion', 'photo', 'survey', 'other']
    },
    description: String,
    fileUrl: String,
    submittedBy: String,
    submissionDate: Date
  }],
  
  // Resolution
  resolution: {
    outcome: {
      type: String,
      enum: ['claimant_favor', 'defendant_favor', 'settlement', 'dismissed', 'withdrawn']
    },
    description: String,
    compensationAmount: Number,
    termsOfSettlement: String
  },
  
  // Financial Impact
  estimatedCost: {
    type: Number,
    default: 0
  },
  
  actualCost: {
    type: Number,
    default: 0
  },
  
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  investigator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Region
  region: {
    type: String,
    required: true
  },
  
  // Updates & Notes
  updates: [{
    date: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    statusChange: String,
    notes: String
  }],
  
  internalNotes: String,
  
  // Flags
  isPublic: {
    type: Boolean,
    default: false
  },
  
  requiresMediation: {
    type: Boolean,
    default: false
  },
  
  isUrgent: {
    type: Boolean,
    default: false
  },
  
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
disputeSchema.index({ status: 1, priority: 1 });
disputeSchema.index({ region: 1, status: 1 });
disputeSchema.index({ filingDate: -1 });
disputeSchema.index({ parcel: 1 });

// Virtual for days since filing
disputeSchema.virtual('daysSinceFiling').get(function() {
  const now = new Date();
  const filed = this.filingDate;
  const diffTime = Math.abs(now - filed);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Method to calculate duration
disputeSchema.methods.getDuration = function() {
  if (this.resolutionDate) {
    const diffTime = Math.abs(this.resolutionDate - this.filingDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  const diffTime = Math.abs(new Date() - this.filingDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const Dispute = mongoose.model('Dispute', disputeSchema);

export default Dispute;
