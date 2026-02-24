import mongoose from 'mongoose';

const parcelSchema = new mongoose.Schema({
  // Parcel Identification
  parcelId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    // Format: RS-BG-001234 (RS = Serbia, BG = Belgrade, unique number)
  },
  
  // Location Information
  region: {
    type: String,
    required: true,
    enum: [
      'Belgrade', 'Šumadija', 'Kolubara', 'Zlatibor',
      'Podunavlje', 'Braničevo', 'Nišava', 'Jablanica', 'Pčinja',
      'Mačva', 'Moravica', 'Raška', 'Rasina', 'Pomoravlje',
      'Bor', 'Zaječar', 'Toplica', 'Pirot', 'Srem',
      'Južna Bačka', 'Severna Bačka', 'Zapadna Bačka',
      'Severni Banat', 'Srednji Banat', 'Južni Banat'
    ]
  },
  
  district: {
    type: String,
    required: true
  },
  
  municipality: {
    type: String,
    required: true
  },
  
  cadastralMunicipality: {
    type: String,
    required: true
  },
  
  address: {
    street: String,
    number: String,
    postalCode: String,
    city: String
  },
  
  // Geographic Coordinates
  coordinates: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    }
  },
  
  // Parcel Details
  area: {
    type: Number, // in square meters
    required: true
  },
  
  landType: {
    type: String,
    enum: ['agricultural', 'residential', 'commercial', 'industrial', 'forest', 'mixed'],
    required: true
  },
  
  landUse: {
    type: String,
    enum: ['building', 'farming', 'vacant', 'developed', 'protected'],
    required: true
  },
  
  // Ownership Information
  currentOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },
  
  ownershipType: {
    type: String,
    enum: ['private', 'state', 'municipal', 'cooperative', 'shared'],
    required: true
  },
  
  // Legal Status
  legalStatus: {
    type: String,
    enum: ['verified', 'pending', 'disputed', 'restricted', 'clean'],
    required: true,
    default: 'pending'
  },
  
  // Valuation
  marketValue: {
    type: Number, // in EUR
    required: true
  },
  
  taxValue: {
    type: Number, // in EUR
    required: true
  },
  
  lastValuationDate: {
    type: Date,
    default: Date.now
  },
  
  // Encumbrances
  hasMortgage: {
    type: Boolean,
    default: false
  },
  
  hasLien: {
    type: Boolean,
    default: false
  },
  
  hasEasement: {
    type: Boolean,
    default: false
  },
  
  restrictions: [{
    type: {
      type: String,
      enum: ['mortgage', 'lien', 'easement', 'zoning', 'environmental', 'legal']
    },
    description: String,
    startDate: Date,
    endDate: Date,
    amount: Number
  }],
  
  // Blockchain / Audit Trail
  blockchainHash: {
    type: String,
    index: true
  },
  
  lastVerifiedDate: {
    type: Date,
    default: Date.now
  },
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Flags
  isActive: {
    type: Boolean,
    default: true
  },
  
  isFraudulent: {
    type: Boolean,
    default: false
  },
  
  fraudAlerts: [{
    date: Date,
    reason: String,
    detectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Metadata
  registrationDate: {
    type: Date,
    default: Date.now
  },
  
  lastModified: {
    type: Date,
    default: Date.now
  },
  
  notes: String

}, {
  timestamps: true
});

// Indexes for better query performance
parcelSchema.index({ region: 1, legalStatus: 1 });
parcelSchema.index({ currentOwner: 1 });
parcelSchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

// Virtual for ownership history
parcelSchema.virtual('ownershipHistory', {
  ref: 'OwnershipHistory',
  localField: '_id',
  foreignField: 'parcel'
});

const Parcel = mongoose.model('Parcel', parcelSchema);

export default Parcel;

// import mongoose from 'mongoose';

// const parcelSchema = new mongoose.Schema({
//   // Parcel Identification
//   parcelId: {
//     type: String,
//     required: true,
//     unique: true,
//     index: true,
//     // Format: RS-BG-001234 (RS = Serbia, BG = Belgrade, unique number)
//   },
  
//   // Location Information
//   region: {
//     type: String,
//     required: true,
//     enum: [
//       'Belgrade', 'Vojvodina', 'Šumadija', 'Kolubara', 'Zlatibor',
//       'Podunavlje', 'Braničevo', 'Nišava', 'Jablanica', 'Pčinja',
//       'Mačva', 'Moravica', 'Raška', 'Rasina', 'Pomoravlje',
//       'Bor', 'Zaječar', 'Toplica', 'Pirot', 'Srem',
//       'South Bačka', 'North Bačka', 'West Bačka',
//       'North Banat', 'Central Banat', 'South Banat'
//     ]
//   },
  
//   district: {
//     type: String,
//     required: true
//   },
  
//   municipality: {
//     type: String,
//     required: true
//   },
  
//   cadastralMunicipality: {
//     type: String,
//     required: true
//   },
  
//   address: {
//     street: String,
//     number: String,
//     postalCode: String,
//     city: String
//   },
  
//   // Geographic Coordinates
//   coordinates: {
//     latitude: {
//       type: Number,
//       required: true
//     },
//     longitude: {
//       type: Number,
//       required: true
//     }
//   },
  
//   // Parcel Details
//   area: {
//     type: Number, // in square meters
//     required: true
//   },
  
//   landType: {
//     type: String,
//     enum: ['agricultural', 'residential', 'commercial', 'industrial', 'forest', 'mixed'],
//     required: true
//   },
  
//   landUse: {
//     type: String,
//     enum: ['building', 'farming', 'vacant', 'developed', 'protected'],
//     required: true
//   },
  
//   // Ownership Information
//   currentOwner: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Owner',
//     required: true
//   },
  
//   ownershipType: {
//     type: String,
//     enum: ['private', 'state', 'municipal', 'cooperative', 'shared'],
//     required: true
//   },
  
//   // Legal Status
//   legalStatus: {
//     type: String,
//     enum: ['verified', 'pending', 'disputed', 'restricted', 'clean'],
//     required: true,
//     default: 'pending'
//   },
  
//   // Valuation
//   marketValue: {
//     type: Number, // in EUR
//     required: true
//   },
  
//   taxValue: {
//     type: Number, // in EUR
//     required: true
//   },
  
//   lastValuationDate: {
//     type: Date,
//     default: Date.now
//   },
  
//   // Encumbrances
//   hasMortgage: {
//     type: Boolean,
//     default: false
//   },
  
//   hasLien: {
//     type: Boolean,
//     default: false
//   },
  
//   hasEasement: {
//     type: Boolean,
//     default: false
//   },
  
//   restrictions: [{
//     type: {
//       type: String,
//       enum: ['mortgage', 'lien', 'easement', 'zoning', 'environmental', 'legal']
//     },
//     description: String,
//     startDate: Date,
//     endDate: Date,
//     amount: Number
//   }],
  
//   // Blockchain / Audit Trail
//   blockchainHash: {
//     type: String,
//     index: true
//   },
  
//   lastVerifiedDate: {
//     type: Date,
//     default: Date.now
//   },
  
//   verifiedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
  
//   // Flags
//   isActive: {
//     type: Boolean,
//     default: true
//   },
  
//   isFraudulent: {
//     type: Boolean,
//     default: false
//   },
  
//   fraudAlerts: [{
//     date: Date,
//     reason: String,
//     detectedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],
  
//   // Metadata
//   registrationDate: {
//     type: Date,
//     default: Date.now
//   },
  
//   lastModified: {
//     type: Date,
//     default: Date.now
//   },
  
//   notes: String

// }, {
//   timestamps: true
// });

// // Indexes for better query performance
// parcelSchema.index({ region: 1, legalStatus: 1 });
// parcelSchema.index({ currentOwner: 1 });
// parcelSchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

// // Virtual for ownership history
// parcelSchema.virtual('ownershipHistory', {
//   ref: 'OwnershipHistory',
//   localField: '_id',
//   foreignField: 'parcel'
// });

// const Parcel = mongoose.model('Parcel', parcelSchema);

// export default Parcel;
