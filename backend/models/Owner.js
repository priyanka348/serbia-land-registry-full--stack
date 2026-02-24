import mongoose from 'mongoose';

const ownerSchema = new mongoose.Schema({
  // Owner Type
  ownerType: {
    type: String,
    enum: ['individual', 'corporation', 'government', 'cooperative', 'foundation'],
    required: true
  },
  
  // For Individual Owners
  personalInfo: {
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    nationalId: {
      type: String,
      unique: true,
      sparse: true // allows multiple nulls
    },
    taxId: String
  },
  
  // For Corporate Owners
  corporateInfo: {
    companyName: String,
    registrationNumber: String,
    taxId: String,
    legalForm: {
      type: String,
      enum: ['LLC', 'JSC', 'Partnership', 'Sole Proprietorship', 'NGO', 'Other']
    },
    incorporationDate: Date
  },
  
  // Contact Information
  contact: {
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: String,
    mobile: String,
    fax: String
  },
  
  // Address
  address: {
    street: String,
    number: String,
    apartment: String,
    city: String,
    municipality: String,
    postalCode: String,
    country: {
      type: String,
      default: 'Serbia'
    }
  },
  
  // Citizenship/Registration
  citizenship: {
    type: String,
    default: 'Serbian'
  },
  
  residencyStatus: {
    type: String,
    enum: ['resident', 'non-resident', 'foreign'],
    default: 'resident'
  },
  
  // Legal Status
  legalCapacity: {
    type: String,
    enum: ['full', 'limited', 'none'],
    default: 'full'
  },
  
  isBlacklisted: {
    type: Boolean,
    default: false
  },
  
  blacklistReason: String,
  
  // Property Portfolio
  ownedParcels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parcel'
  }],
  
  totalLandArea: {
    type: Number,
    default: 0 // in square meters
  },
  
  totalPropertyValue: {
    type: Number,
    default: 0 // in EUR
  },
  
  // Financial Information
  creditScore: {
    type: Number,
    min: 300,
    max: 850
  },
  
  outstandingMortgages: {
    type: Number,
    default: 0
  },
  
  // Legal Representatives (for corporate or limited capacity owners)
  legalRepresentatives: [{
    name: String,
    role: String,
    nationalId: String,
    appointmentDate: Date
  }],
  
  // Verification Status
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verificationDate: Date,
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Metadata
  registrationDate: {
    type: Date,
    default: Date.now
  },
  
  lastActivity: {
    type: Date,
    default: Date.now
  },
  
  notes: String

}, {
  timestamps: true
});

// Indexes
ownerSchema.index({ 'personalInfo.nationalId': 1 });
ownerSchema.index({ 'corporateInfo.registrationNumber': 1 });
ownerSchema.index({ ownerType: 1, isVerified: 1 });
ownerSchema.index({ 'contact.email': 1 });

// Virtual for full name (individuals)
ownerSchema.virtual('fullName').get(function() {
  if (this.ownerType === 'individual' && this.personalInfo) {
    return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
  } else if (this.ownerType === 'corporation' && this.corporateInfo) {
    return this.corporateInfo.companyName;
  }
  return 'Unknown Owner';
});

// Method to update property statistics
ownerSchema.methods.updatePropertyStats = async function() {
  const Parcel = mongoose.model('Parcel');
  const parcels = await Parcel.find({ currentOwner: this._id });
  
  this.totalLandArea = parcels.reduce((sum, p) => sum + p.area, 0);
  this.totalPropertyValue = parcels.reduce((sum, p) => sum + p.marketValue, 0);
  
  await this.save();
};

const Owner = mongoose.model('Owner', ownerSchema);

export default Owner;
