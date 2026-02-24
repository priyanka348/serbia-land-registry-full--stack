import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // User Identification
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
    // Format: USR-2024-001234
  },
  
  // Personal Information
  firstName: {
    type: String,
    required: true
  },
  
  lastName: {
    type: String,
    required: true
  },
  
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  // Authentication
  password: {
    type: String,
    required: true,
    select: false // Don't return password in queries by default
  },
  
  // Role and Permissions
  role: {
    type: String,
    enum: ['admin', 'minister', 'registrar', 'judge', 'auditor', 'clerk', 'viewer'],
    required: true,
    default: 'viewer'
  },
  
  permissions: [{
    type: String,
    enum: [
      'create_parcel',
      'edit_parcel',
      'delete_parcel',
      'approve_transfer',
      'reject_transfer',
      'create_dispute',
      'resolve_dispute',
      'view_audit_logs',
      'approve_mortgage',
      'generate_reports',
      'manage_users',
      'view_all_regions',
      'blockchain_access'
    ]
  }],
  
  // Employment Information
  employeeId: String,
  
  department: {
    type: String,
    enum: [
      'land_registry',
      'legal',
      'finance',
      'audit',
      'judiciary',
      'IT',
      'administration',
      'management'
    ]
  },
  
  position: String,
  
  hireDate: Date,
  
  // Region Assignment
  assignedRegions: [{
    type: String
  }],
  
  primaryOffice: String,
  
  // Contact Information
  phone: String,
  
  mobile: String,
  
  officeAddress: {
    street: String,
    city: String,
    postalCode: String
  },
  
  // Professional Credentials
  licenseNumber: String,
  
  barNumber: String, // For judges/lawyers
  
  certifications: [{
    name: String,
    issuingAuthority: String,
    issueDate: Date,
    expiryDate: Date
  }],
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  isSuspended: {
    type: Boolean,
    default: false
  },
  
  suspensionReason: String,
  
  // Security
  lastLogin: Date,
  
  lastPasswordChange: Date,
  
  passwordResetToken: String,
  
  passwordResetExpires: Date,
  
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  
  twoFactorSecret: String,
  
  // Activity Tracking
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: Date,
  
  failedLoginAttempts: [{
    timestamp: Date,
    ipAddress: String
  }],
  
  loginHistory: [{
    timestamp: Date,
    ipAddress: String,
    userAgent: String,
    success: Boolean
  }],
  
  // Workload Statistics
  statistics: {
    parcelsCreated: {
      type: Number,
      default: 0
    },
    transfersProcessed: {
      type: Number,
      default: 0
    },
    disputesResolved: {
      type: Number,
      default: 0
    },
    mortgagesApproved: {
      type: Number,
      default: 0
    },
    averageProcessingTime: {
      type: Number, // in hours
      default: 0
    }
  },
  
  // Performance Metrics
  performanceRating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  
  lastPerformanceReview: Date,
  
  // Supervisor
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Notifications Preferences
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    },
    inApp: {
      type: Boolean,
      default: true
    }
  },
  
  // Profile
  profilePicture: String,
  
  bio: String,
  
  // Digital Signature
  digitalSignature: {
    publicKey: String,
    certificateNumber: String,
    issuer: String,
    validUntil: Date
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  notes: String

}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ assignedRegions: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = async function() {
  // If lock has expired, reset attempts
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  // Increment attempts
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts
  const maxAttempts = 5;
  if (this.loginAttempts + 1 >= maxAttempts) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return await this.updateOne(updates);
};

// Method to record successful login
userSchema.methods.recordLogin = async function(ipAddress, userAgent) {
  this.lastLogin = new Date();
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  
  this.loginHistory.push({
    timestamp: new Date(),
    ipAddress,
    userAgent,
    success: true
  });
  
  // Keep only last 20 login records
  if (this.loginHistory.length > 20) {
    this.loginHistory = this.loginHistory.slice(-20);
  }
  
  await this.save();
};

const User = mongoose.model('User', userSchema);

export default User;
