import jwt from 'jsonwebtoken';
import { User, AuditLog } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Authentication Service
 * Contains all business logic for authentication
 */
class AuthService {
  /**
   * Generate JWT token for user
   */
  generateToken(userId, role) {
    return jwt.sign(
      { userId, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  /**
   * Generate refresh token (longer expiry)
   */
  generateRefreshToken(userId) {
    return jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
  }

  /**
   * Login user with email and password
   */
  async login(email, password, ipAddress, userAgent) {
    // Find user by email (include password for comparison)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if account is locked
    if (user.isLocked()) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
      throw new AppError(
        `Account is locked. Try again in ${lockTime} minutes.`,
        423
      );
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated. Contact administrator.', 403);
    }

    // Check if account is suspended
    if (user.isSuspended) {
      throw new AppError(
        `Account is suspended. Reason: ${user.suspensionReason || 'Contact administrator'}`,
        403
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment failed login attempts
      await user.incLoginAttempts();
      
      // Log failed attempt
      await AuditLog.logEvent({
        eventType: 'user_login',
        action: 'Failed login attempt',
        performedBy: user._id,
        userRole: user.role,
        targetModel: 'User',
        targetId: user._id,
        ipAddress,
        userAgent,
        status: 'failure',
        severity: 'medium',
        errorMessage: 'Invalid password'
      });

      throw new AppError('Invalid email or password', 401);
    }

    // Generate tokens
    const token = this.generateToken(user._id, user.role);
    const refreshToken = this.generateRefreshToken(user._id);

    // Record successful login
    await user.recordLogin(ipAddress, userAgent);

    // Log successful login
    await AuditLog.logEvent({
      eventType: 'user_login',
      action: `User logged in: ${user.email}`,
      performedBy: user._id,
      userRole: user.role,
      targetModel: 'User',
      targetId: user._id,
      ipAddress,
      userAgent,
      status: 'success',
      severity: 'info'
    });

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    return {
      user: userResponse,
      token,
      refreshToken
    };
  }

  /**
   * Logout user (client-side token removal, server-side logging)
   */
  async logout(userId, ipAddress) {
    const user = await User.findById(userId);

    if (user) {
      // Log logout event
      await AuditLog.logEvent({
        eventType: 'user_logout',
        action: `User logged out: ${user.email}`,
        performedBy: userId,
        userRole: user.role,
        targetModel: 'User',
        targetId: userId,
        ipAddress,
        status: 'success',
        severity: 'info'
      });
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );

      if (decoded.type !== 'refresh') {
        throw new AppError('Invalid refresh token', 401);
      }

      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        throw new AppError('Invalid refresh token', 401);
      }

      // Generate new access token
      const newToken = this.generateToken(user._id, user.role);

      return { token: newToken };
    } catch (error) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId) {
    const user = await User.findById(userId).select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  /**
   * Update user password
   */
  async updatePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Update password
    user.password = newPassword;
    user.lastPasswordChange = new Date();
    await user.save();

    // Log password change
    await AuditLog.logEvent({
      eventType: 'user_updated',
      action: 'Password changed',
      performedBy: userId,
      userRole: user.role,
      targetModel: 'User',
      targetId: userId,
      status: 'success',
      severity: 'medium'
    });

    return { message: 'Password updated successfully' };
  }

  /**
   * Verify user's email or credentials
   */
  async verifyUser(userId, verificationCode) {
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Implement your verification logic here
    user.isVerified = true;
    await user.save();

    return { message: 'User verified successfully' };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If email exists, reset link has been sent' };
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // In production, send email with reset link
    // For now, just return the token (remove in production!)
    return {
      message: 'Password reset link sent to email',
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetToken, newPassword) {
    try {
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);

      if (decoded.type !== 'password_reset') {
        throw new AppError('Invalid reset token', 400);
      }

      const user = await User.findOne({
        _id: decoded.userId,
        passwordResetToken: resetToken,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new AppError('Invalid or expired reset token', 400);
      }

      // Update password
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.lastPasswordChange = new Date();
      await user.save();

      // Log password reset
      await AuditLog.logEvent({
        eventType: 'user_updated',
        action: 'Password reset completed',
        performedBy: user._id,
        userRole: user.role,
        targetModel: 'User',
        targetId: user._id,
        status: 'success',
        severity: 'high'
      });

      return { message: 'Password reset successful' };
    } catch (error) {
      throw new AppError('Invalid or expired reset token', 400);
    }
  }
}

export default new AuthService();
