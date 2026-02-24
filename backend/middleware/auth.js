import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

/**
 * Middleware to verify JWT token and authenticate user
 * Attaches user object to req.user if authentication succeeds
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database (exclude password)
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    // Check if user is suspended
    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended.'
      });
    }

    // Attach user to request object
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

/**
 * Middleware to check if user has required role(s)
 * Usage: authorize('admin', 'minister')
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has specific permission(s)
 * Usage: checkPermission('create_parcel', 'edit_parcel')
 */
export const checkPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const hasPermission = requiredPermissions.some(permission =>
      req.user.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${requiredPermissions.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has access to specific region
 * Usage: checkRegionAccess()
 */
export const checkRegionAccess = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admin and minister have access to all regions
    if (['admin', 'minister'].includes(req.user.role)) {
      return next();
    }

    // Check if specific region access is needed
    const requestedRegion = req.query.region || req.body.region || req.params.region;

    if (requestedRegion && !req.user.assignedRegions.includes(requestedRegion)) {
      return res.status(403).json({
        success: false,
        message: `Access denied to region: ${requestedRegion}`
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token provided
 * Useful for endpoints that work with or without authentication
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (user && user.isActive && !user.isSuspended) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};
