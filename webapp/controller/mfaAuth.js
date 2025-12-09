/**
 * @name            jPulse Framework / Plugins / Auth-MFA / WebApp / Controller / MFA Auth
 * @tagline         MFA Authentication Controller
 * @description     Multi-factor authentication using TOTP
 * @file            plugins/auth-mfa/webapp/controller/mfaAuth.js
 * @version         1.0.1
 * @release         2025-12-09
 * @repository      https://github.com/jpulse-net/plugin-auth-mfa
 * @author          Peter Thoeny, https://twiki.org & https://github.com/peterthoeny/
 * @copyright       2025 Peter Thoeny, https://twiki.org & https://github.com/peterthoeny/
 * @license         BSL 1.1 -- see LICENSE file; for commercial use: team@jpulse.net
 * @genai           80%, Cursor 2.1, Claude Sonnet 4.5
*/

import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import MfaAuthModel from '../model/mfaAuth.js';
import LogController from '../../../../webapp/controller/log.js';

/**
 * MFA Auth Controller
 * Provides TOTP-based multi-factor authentication
 */
class MfaAuthController {

    // ========================================================================
    // Hook Declarations (Phase 8 simplified naming)
    // Hooks are auto-registered by PluginManager during bootstrap
    // ========================================================================
    static hooks = {
        // Multi-step authentication hooks
        onAuthGetSteps: { priority: 100 },
        onAuthValidateStep: { priority: 100 },
        onAuthGetWarnings: { priority: 100 }
    };

    // ========================================================================
    // API Endpoints - explicit routes take precedence over api* discovery
    // Paths use plugin name for self-documentation: /api/1/auth-mfa/...
    // ========================================================================
    static routes = [
        { method: 'GET',  path: '/api/1/auth-mfa/status',        handler: 'apiStatus',       auth: 'user' },
        { method: 'POST', path: '/api/1/auth-mfa/setup',         handler: 'apiSetup',        auth: 'user' },
        { method: 'POST', path: '/api/1/auth-mfa/verify-setup',  handler: 'apiVerifySetup',  auth: 'user' },
        { method: 'POST', path: '/api/1/auth-mfa/disable',       handler: 'apiDisable',      auth: 'user' },
        { method: 'POST', path: '/api/1/auth-mfa/backup-codes',  handler: 'apiBackupCodes',  auth: 'user' }
        // Note: MFA verification during login is handled via authExecuteStepHook (W-109)
        // No separate verify/verify-backup endpoints needed
    ];

    /**
     * Initialize controller
     * Called by plugin loader
     */
    static async initialize() {
        await MfaAuthModel.initialize();
    }

    // ========================================================================
    // Multi-step Authentication Hooks (Phase 8 naming)
    // ========================================================================

    /**
     * Check if MFA step is required for this user
     * @param {object} context - { req, user, completedSteps, requiredSteps }
     * @returns {object} Modified context with MFA step added if required
     */
    static async onAuthGetSteps(context) {
        const { user, requiredSteps, req } = context;

        try {
            if (!user) {
                return context;
            }

            // Check if user has MFA enabled - only require MFA verification for users WITH MFA
            // Users WITHOUT MFA get a nag warning via onAuthGetWarnings instead
            if (user.mfa?.enabled) {
                // Check if locked out
                const lockStatus = MfaAuthModel.isLocked(user);
                if (lockStatus.locked) {
                    // Still add MFA step - will fail with lock message
                    LogController.logInfo(req, 'mfaAuth.onAuthGetSteps',
                        `User ${user.username} MFA locked for ${lockStatus.remainingMinutes} minutes`);
                }

                requiredSteps.push({
                    step: 'mfa',
                    priority: 100,
                    data: {
                        mfaMethod: user.mfa.method || 'totp',
                        isLocked: lockStatus?.locked || false,
                        lockoutMinutes: lockStatus?.remainingMinutes || 0
                    }
                });

                LogController.logInfo(req, 'mfaAuth.onAuthGetSteps',
                    `MFA step required for user ${user.username}`);
            }
            // Note: Users WITHOUT MFA enabled get a nag warning via onAuthGetWarnings
            // instead of blocking login with a required step
        } catch (error) {
            LogController.logError(req, 'mfaAuth.onAuthGetSteps',
                `Error checking MFA requirement: ${error.message}`);
        }

        return context;
    }

    /**
     * Execute MFA verification step
     * @param {object} context - { req, user, step, stepData, pending, valid, error }
     * @returns {object} Modified context with validation result
     */
    static async onAuthValidateStep(context) {
        const { step, stepData, pending, user, req } = context;

        // Handle 'mfa' step (TOTP code) or 'mfa-backup' step (backup code)
        if (step !== 'mfa' && step !== 'mfa-backup') {
            return context;
        }

        try {
            const { code } = stepData;

            if (!code) {
                context.valid = false;
                context.error = step === 'mfa' ? 'MFA code required' : 'Backup code required';
                LogController.logError(req, 'mfaAuth.onAuthValidateStep',
                    `${step} code missing for user ${pending.username}`);
                return context;
            }

            // User is provided by core auth controller via context
            if (!user) {
                context.valid = false;
                context.error = 'User not found';
                LogController.logError(req, 'mfaAuth.onAuthValidateStep',
                    `User not found for pending auth: ${pending.userId}`);
                return context;
            }

            // Check if locked
            const lockStatus = MfaAuthModel.isLocked(user);
            if (lockStatus.locked) {
                context.valid = false;
                context.error = `Account is temporarily locked. Try again in ${lockStatus.remainingMinutes} minute(s).`;
                LogController.logInfo(req, 'mfaAuth.onAuthValidateStep',
                    `User ${user.username} MFA locked for ${lockStatus.remainingMinutes} minutes`);
                return context;
            }

            let isValid = false;

            if (step === 'mfa-backup') {
                // Validate backup code
                const cleanCode = code.toString().replace(/[\s-]/g, '').toUpperCase();
                isValid = await MfaAuthModel.useBackupCode(pending.userId, cleanCode);

                if (isValid) {
                    await MfaAuthModel.recordSuccess(user._id.toString());
                    context.valid = true;
                    LogController.logInfo(req, 'mfaAuth.onAuthValidateStep',
                        `Backup code verification successful for user ${user.username}`);
                } else {
                    await MfaAuthModel.recordFailure(user._id.toString());
                    context.valid = false;
                    context.error = 'Invalid or already used backup code';
                    LogController.logInfo(req, 'mfaAuth.onAuthValidateStep',
                        `Backup code verification failed for user ${user.username}`);
                }
            } else {
                // Validate TOTP code (default window of 1 step = 30 seconds tolerance)
                const secret = MfaAuthModel.getDecryptedSecret(user);
                if (!secret) {
                    context.valid = false;
                    context.error = 'MFA not configured';
                    LogController.logError(req, 'mfaAuth.onAuthValidateStep',
                        `MFA not configured for user ${user.username}`);
                    return context;
                }

                const cleanCode = code.toString().replace(/\s/g, '');
                isValid = authenticator.verify({
                    token: cleanCode,
                    secret: secret
                });

                if (isValid) {
                    await MfaAuthModel.recordSuccess(user._id.toString());
                    context.valid = true;
                    LogController.logInfo(req, 'mfaAuth.onAuthValidateStep',
                        `MFA verification successful for user ${user.username}`);
                } else {
                    await MfaAuthModel.recordFailure(user._id.toString());
                    context.valid = false;
                    context.error = 'Invalid MFA code';
                    LogController.logInfo(req, 'mfaAuth.onAuthValidateStep',
                        `MFA verification failed for user ${user.username}`);
                }
            }
        } catch (error) {
            LogController.logError(req, 'mfaAuth.onAuthValidateStep',
                `Error validating MFA: ${error.message}`);
            context.valid = false;
            context.error = 'MFA verification failed';
        }

        return context;
    }

    /**
     * Return non-blocking login warnings (nag messages)
     * Shows warning if MFA is required by policy but not enabled
     * @param {object} context - { req, user, warnings }
     * @returns {object} Modified context with warnings array
     */
    static async onAuthGetWarnings(context) {
        const { user, warnings, req } = context;

        try {
            if (!user) {
                return context;
            }

            // Check if MFA is enabled for this user
            const mfaEnabled = user.mfa?.enabled === true;

            if (!mfaEnabled) {
                // Check if MFA is required by policy
                const mfaRequired = await MfaAuthModel.isMfaRequired(user);

                if (mfaRequired.required) {
                    // MFA is required but not enabled - strong warning (red toast)
                    warnings.push({
                        type: 'mfa-not-enabled',
                        toastType: 'error',
                        message: mfaRequired.reason === 'policy-required'
                            ? 'Two-factor authentication is required. Please set up 2FA in your profile.'
                            : 'Two-factor authentication is required for your role. Please set up 2FA in your profile.',
                        link: '/jpulse-plugins/auth-mfa.shtml',
                        linkText: 'Set up 2FA'
                    });

                    LogController.logInfo(req, 'mfaAuth.onAuthGetWarnings',
                        `MFA warning added for user ${user.username}: ${mfaRequired.reason}`);
                } else if (mfaRequired.reason === 'optional') {
                    // MFA is optional - soft nag to encourage setup (red toast)
                    warnings.push({
                        type: 'mfa-recommended',
                        toastType: 'error',
                        message: 'Secure your account with two-factor authentication.',
                        link: '/jpulse-plugins/auth-mfa.shtml',
                        linkText: 'Enable 2FA'
                    });

                    LogController.logInfo(req, 'mfaAuth.onAuthGetWarnings',
                        `MFA recommendation added for user ${user.username}`);
                }
            }
        } catch (error) {
            LogController.logError(req, 'mfaAuth.onAuthGetWarnings',
                `Error checking MFA policy: ${error.message}`);
        }

        return context;
    }

    // ========================================================================
    // API Endpoints
    // ========================================================================

    /**
     * Get MFA status for current user
     * GET /api/1/auth-mfa/status
     */
    static async apiStatus(req, res) {
        const startTime = Date.now();
        LogController.logRequest(req, 'mfaAuth.apiStatus', '');

        try {
            // req.user is loaded by middleware for authenticated routes
            const user = req.user;
            if (!user) {
                LogController.logError(req, 'mfaAuth.apiStatus', 'User not found');
                return res.status(401).json({
                    success: false,
                    error: 'Not authenticated'
                });
            }

            const userId = user._id.toString();
            const status = await MfaAuthModel.getUserMfaStatus(userId);
            const mfaRequired = await MfaAuthModel.isMfaRequired(user);

            const elapsed = Date.now() - startTime;
            LogController.logInfo(req, 'mfaAuth.apiStatus', `success: enabled=${status.enabled}, completed in ${elapsed}ms`);

            res.json({
                success: true,
                data: {
                    ...status,
                    policyRequired: mfaRequired.required,
                    policyReason: mfaRequired.reason
                }
            });
        } catch (error) {
            LogController.logError(req, 'mfaAuth.apiStatus', `error: ${error.message}`);
            res.status(500).json({
                success: false,
                error: 'Failed to get MFA status'
            });
        }
    }

    /**
     * Start MFA enrollment - returns QR code
     * POST /api/1/auth-mfa/setup
     */
    static async apiSetup(req, res) {
        const startTime = Date.now();
        LogController.logRequest(req, 'mfaAuth.apiSetup', '');

        try {
            // req.user is loaded by middleware for authenticated routes
            const user = req.user;
            if (!user) {
                LogController.logError(req, 'mfaAuth.apiSetup', 'User not found');
                return res.status(401).json({
                    success: false,
                    error: 'Not authenticated'
                });
            }

            const userId = user._id.toString();

            // Check if already enabled
            if (user.mfa?.enabled) {
                LogController.logError(req, 'mfaAuth.apiSetup', 'MFA is already enabled');
                return res.status(400).json({
                    success: false,
                    error: 'MFA is already enabled'
                });
            }

            // Generate secret
            const secret = authenticator.generateSecret();

            // Get issuer name from config
            const config = await MfaAuthModel.getConfig();
            const issuer = config.issuerName || 'jPulse';

            // Generate OTP auth URL
            const otpauth = authenticator.keyuri(
                user.email || user.username,
                issuer,
                secret
            );

            // Generate QR code as data URL
            const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

            // Store secret temporarily in session for verification
            req.session.mfaPendingSecret = secret;

            const elapsed = Date.now() - startTime;
            LogController.logInfo(req, 'mfaAuth.apiSetup', `success: QR code generated, completed in ${elapsed}ms`);

            res.json({
                success: true,
                data: {
                    secret: secret,
                    qrCode: qrCodeDataUrl,
                    otpauth: otpauth,
                    issuer: issuer
                }
            });
        } catch (error) {
            LogController.logError(req, 'mfaAuth.apiSetup', `error: ${error.message}`);
            res.status(500).json({
                success: false,
                error: 'Failed to setup MFA'
            });
        }
    }

    /**
     * Verify TOTP during enrollment and enable MFA
     * POST /api/1/auth-mfa/verify-setup
     */
    static async apiVerifySetup(req, res) {
        const startTime = Date.now();
        LogController.logRequest(req, 'mfaAuth.apiVerifySetup', '');

        try {
            // req.user is loaded by middleware for authenticated routes
            const user = req.user;
            const { code } = req.body;

            if (!user) {
                LogController.logError(req, 'mfaAuth.apiVerifySetup', 'User not found');
                return res.status(401).json({
                    success: false,
                    error: 'Not authenticated'
                });
            }

            const userId = user._id.toString();

            if (!code) {
                LogController.logError(req, 'mfaAuth.apiVerifySetup', 'Verification code is required');
                return res.status(400).json({
                    success: false,
                    error: 'Verification code is required'
                });
            }

            // Get pending secret from session
            const secret = req.session.mfaPendingSecret;
            if (!secret) {
                LogController.logError(req, 'mfaAuth.apiVerifySetup', 'No pending MFA setup');
                return res.status(400).json({
                    success: false,
                    error: 'No pending MFA setup. Please start setup again.'
                });
            }

            // Verify code
            const isValid = authenticator.verify({
                token: code.toString().replace(/\s/g, ''),
                secret: secret
            });

            if (!isValid) {
                LogController.logError(req, 'mfaAuth.apiVerifySetup', 'Invalid verification code');
                return res.status(400).json({
                    success: false,
                    error: 'Invalid verification code. Please try again.'
                });
            }

            // Enable MFA and generate backup codes
            const result = await MfaAuthModel.enableMfa(userId, secret);

            // Clear pending secret
            delete req.session.mfaPendingSecret;

            const elapsed = Date.now() - startTime;
            LogController.logInfo(req, 'mfaAuth.apiVerifySetup', `success: MFA enabled, completed in ${elapsed}ms`);

            res.json({
                success: true,
                message: 'MFA enabled successfully',
                data: {
                    backupCodes: result.backupCodes
                }
            });
        } catch (error) {
            LogController.logError(req, 'mfaAuth.apiVerifySetup', `error: ${error.message}`);
            res.status(500).json({
                success: false,
                error: 'Failed to enable MFA'
            });
        }
    }

    /**
     * Disable MFA for current user
     * POST /api/1/auth-mfa/disable
     */
    static async apiDisable(req, res) {
        const startTime = Date.now();
        LogController.logRequest(req, 'mfaAuth.apiDisable', '');

        try {
            // req.user is loaded by middleware for authenticated routes
            const user = req.user;
            const { password } = req.body;

            if (!user) {
                LogController.logError(req, 'mfaAuth.apiDisable', 'User not found');
                return res.status(401).json({
                    success: false,
                    error: 'Not authenticated'
                });
            }

            const userId = user._id.toString();

            if (!password) {
                LogController.logError(req, 'mfaAuth.apiDisable', 'Password is required');
                return res.status(400).json({
                    success: false,
                    error: 'Password is required to disable MFA'
                });
            }

            // Check if MFA is required by policy
            const mfaRequired = await MfaAuthModel.isMfaRequired(user);
            if (mfaRequired.required && mfaRequired.reason !== 'enabled') {
                LogController.logError(req, 'mfaAuth.apiDisable', 'MFA is required by policy');
                return res.status(400).json({
                    success: false,
                    error: 'MFA is required by policy and cannot be disabled'
                });
            }

            // Verify password
            const isPasswordValid = await global.UserModel.verifyPassword(password, user.passwordHash);

            if (!isPasswordValid) {
                LogController.logError(req, 'mfaAuth.apiDisable', 'Invalid password');
                return res.status(400).json({
                    success: false,
                    error: 'Invalid password'
                });
            }

            // Disable MFA
            await MfaAuthModel.disableMfa(userId);

            const elapsed = Date.now() - startTime;
            LogController.logInfo(req, 'mfaAuth.apiDisable', `success: MFA disabled, completed in ${elapsed}ms`);

            res.json({
                success: true,
                message: 'MFA disabled successfully'
            });
        } catch (error) {
            LogController.logError(req, 'mfaAuth.apiDisable', `error: ${error.message}`);
            res.status(500).json({
                success: false,
                error: 'Failed to disable MFA'
            });
        }
    }

    /**
     * Generate new backup codes
     * POST /api/1/auth-mfa/backup-codes
     */
    static async apiBackupCodes(req, res) {
        const startTime = Date.now();
        LogController.logRequest(req, 'mfaAuth.apiBackupCodes', '');

        try {
            // req.user is loaded by middleware for authenticated routes
            const user = req.user;
            if (!user) {
                LogController.logError(req, 'mfaAuth.apiBackupCodes', 'User not found');
                return res.status(401).json({
                    success: false,
                    error: 'Not authenticated'
                });
            }

            const userId = user._id.toString();

            if (!user?.mfa?.enabled) {
                LogController.logError(req, 'mfaAuth.apiBackupCodes', 'MFA is not enabled');
                return res.status(400).json({
                    success: false,
                    error: 'MFA is not enabled'
                });
            }

            const codes = await MfaAuthModel.regenerateBackupCodes(userId);

            const elapsed = Date.now() - startTime;
            LogController.logInfo(req, 'mfaAuth.apiBackupCodes', `success: ${codes.length} codes generated, completed in ${elapsed}ms`);

            res.json({
                success: true,
                message: 'New backup codes generated',
                data: {
                    backupCodes: codes
                }
            });
        } catch (error) {
            LogController.logError(req, 'mfaAuth.apiBackupCodes', `error: ${error.message}`);
            res.status(500).json({
                success: false,
                error: 'Failed to generate backup codes'
            });
        }
    }

}

export default MfaAuthController;

// EOF plugins/auth-mfa/webapp/controller/mfaAuth.js
