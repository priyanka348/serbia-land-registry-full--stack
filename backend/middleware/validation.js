import { validationResult } from 'express-validator';

/**
 * Middleware to validate request using express-validator
 * Returns validation errors if any
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
};

/**
 * Common validation rules
 */
export const validationRules = {
  // Email validation
  email: {
    isEmail: {
      errorMessage: 'Invalid email format'
    },
    normalizeEmail: true
  },

  // Password validation
  password: {
    isLength: {
      options: { min: 8 },
      errorMessage: 'Password must be at least 8 characters long'
    },
    matches: {
      options: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      errorMessage: 'Password must contain uppercase, lowercase, number and special character'
    }
  },

  // String validations
  notEmpty: {
    notEmpty: {
      errorMessage: 'This field is required'
    },
    trim: true
  },

  // MongoDB ObjectId validation
  mongoId: {
    isMongoId: {
      errorMessage: 'Invalid ID format'
    }
  }
};
