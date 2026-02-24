import authService from '../services/authService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Authentication Controller
 * Handles all authentication-related HTTP requests
 */

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent') || 'Unknown';

  const result = await authService.login(email, password, ipAddress, userAgent);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken
    }
  });
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
export const logout = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  
  await authService.logout(req.user._id, ipAddress);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  const result = await authService.refreshToken(refreshToken);

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      token: result.token
    }
  });
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user._id);

  res.status(200).json({
    success: true,
    data: { user }
  });
});

/**
 * @route   PUT /api/auth/password
 * @desc    Update password
 * @access  Private
 */
export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const result = await authService.updatePassword(
    req.user._id,
    currentPassword,
    newPassword
  );

  res.status(200).json({
    success: true,
    message: result.message
  });
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const result = await authService.requestPasswordReset(email);

  res.status(200).json({
    success: true,
    message: result.message,
    ...(result.resetToken && { resetToken: result.resetToken })
  });
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;

  const result = await authService.resetPassword(resetToken, newPassword);

  res.status(200).json({
    success: true,
    message: result.message
  });
});

/**
 * @route   POST /api/auth/verify
 * @desc    Verify user account
 * @access  Public
 */
export const verifyUser = asyncHandler(async (req, res) => {
  const { userId, verificationCode } = req.body;

  const result = await authService.verifyUser(userId, verificationCode);

  res.status(200).json({
    success: true,
    message: result.message
  });
});
