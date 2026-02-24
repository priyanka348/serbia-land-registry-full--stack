import express from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validationRules } from '../middleware/validation.js';

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email').custom(validationRules.email.isEmail),
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],
  authController.login
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
    validate
  ],
  authController.refreshToken
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * @route   PUT /api/auth/password
 * @desc    Update user password
 * @access  Private
 */
router.put(
  '/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').custom(validationRules.password.isLength)
      .custom(validationRules.password.matches),
    validate
  ],
  authController.updatePassword
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  [
    body('email').custom(validationRules.email.isEmail),
    validate
  ],
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password',
  [
    body('resetToken').notEmpty().withMessage('Reset token is required'),
    body('newPassword').custom(validationRules.password.isLength)
      .custom(validationRules.password.matches),
    validate
  ],
  authController.resetPassword
);

/**
 * @route   POST /api/auth/verify
 * @desc    Verify user account
 * @access  Public
 */
router.post(
  '/verify',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('verificationCode').notEmpty().withMessage('Verification code is required'),
    validate
  ],
  authController.verifyUser
);

export default router;
