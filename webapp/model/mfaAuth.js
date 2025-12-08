/*
 * @name            jPulse Framework / Plugins / Auth-MFA / WebApp / Model / MFA Auth
 * @tagline         MFA Data Model
 * @description     MFA User Profile Component shows MFA status and management options in user profile
 * @file            plugins/auth-mfa/webapp/model/mfaAuth.js
 * @version         1.0.0
 * @release         2025-12-08
 * @repository      https://github.com/jpulse-net/plugin-auth-mfa
 * @author          Peter Thoeny, https://twiki.org & https://github.com/peterthoeny/
 * @copyright       2025 Peter Thoeny, https://twiki.org & https://github.com/peterthoeny/
 * @license         BSL 1.1 -- see LICENSE file; for commercial use: team@jpulse.net
 * @genai           80%, Cursor 2.1, Claude Sonnet 4.5
*/

import crypto from 'crypto';

// PluginModel will be resolved at runtime when plugin is loaded
let PluginModel = null;

/**
 * MFA Auth Model
 * Handles user MFA data, configuration, and crypto operations
 * Uses global.UserModel for user data access (available after bootstrap)
 */
class MfaAuthModel {

    /**
     * Initialize model with framework dependencies
     * Called by plugin loader after framework is ready
     */
    static async initialize() {
        // PluginModel - load from framework for config access
        try {
            const pluginModule = await import('../../../../webapp/model/plugin.js');
            PluginModel = pluginModule.default;
        } catch (error) {
            // Plugin model not available - use defaults
            PluginModel = null;
            console.error('MfaAuthModel: Failed to load PluginModel:', error.message);
        }

        // Extend user schema with MFA fields
        this.registerSchemaExtension();
    }

    /**
     * Register MFA schema extension with global.UserModel
     * W-107: Enhanced with adminCard/userCard for data-driven profile cards
     */
    static registerSchemaExtension() {
        if (!global.UserModel) {
            console.error('MfaAuthModel: global.UserModel not available for schema extension');
            return;
        }

        global.UserModel.extendSchema({
            mfa: {
                // W-107: Card metadata for admin and user profile pages
                _meta: {
                    plugin: 'auth-mfa',
                    adminCard: {
                        visible: true,
                        label: 'MFA Settings',
                        icon: '🔐',
                        description: 'Two-factor authentication status and management',
                        backgroundColor: '#fef9e7',
                        order: 100,
                        actions: [
                            {
                                id: 'reset',
                                label: 'Reset MFA',
                                style: 'warning',
                                icon: '🔄',
                                confirm: 'Reset MFA for this user? They will need to set it up again.',
                                toast: "The user's MFA has been reset. Don't forget to save the changes.",
                                showIf: { field: 'mfa.enabled', equals: true },
                                setFields: {
                                    'mfa.enabled': false,
                                    'mfa.secret': '',
                                    'mfa.backupCodes': [],
                                    'mfa.enrolledAt': null,
                                    'mfa.failedAttempts': 0,
                                    'mfa.lockedUntil': null
                                }
                            },
                            {
                                id: 'unlock',
                                label: 'Unlock',
                                style: 'success',
                                icon: '🔓',
                                confirm: 'Unlock this user?',
                                toast: "The user has been unlocked. Don't forget to save the changes.",
                                showIf: { field: 'mfa.lockedUntil', condition: 'exists' },
                                setFields: {
                                    'mfa.failedAttempts': 0,
                                    'mfa.lockedUntil': null
                                }
                            }
                        ]
                    },
                    userCard: {
                        visible: true,
                        label: 'Two-Factor Authentication',
                        icon: '🔐',
                        description: 'Secure your account with an authenticator app',
                        backgroundColor: '#e8f5e9',
                        order: 10,
                        actions: [
                            {
                                id: 'setup',
                                label: 'Enable 2FA',
                                style: 'primary',
                                showIf: { field: 'mfa.enabled', equals: false },
                                navigate: '/auth/mfa-setup.shtml'
                            },
                            {
                                id: 'disable',
                                label: 'Disable 2FA',
                                style: 'danger',
                                confirm: 'Disable two-factor authentication? Your account will be less secure.',
                                toast: 'Two-factor authentication has been disabled.',
                                showIf: {
                                    all: [
                                        { field: 'mfa.enabled', equals: true },
                                        { config: 'auth-mfa.allowUserDisable', equals: true }
                                    ]
                                },
                                setFields: {
                                    'mfa.enabled': false,
                                    'mfa.secret': '',
                                    'mfa.backupCodes': [],
                                    'mfa.enrolledAt': null
                                }
                            },
                            {
                                id: 'regenerate',
                                label: 'New Backup Codes',
                                style: 'secondary',
                                showIf: { field: 'mfa.enabled', equals: true },
                                handler: 'mfa.regenerateBackupCodes'
                            }
                        ]
                    }
                },

                // Field definitions with visibility settings
                enabled: {
                    type: 'boolean',
                    default: false,
                    label: 'Status',
                    adminCard: { visible: true, readOnly: true },
                    userCard: { visible: true, readOnly: true },
                    displayAs: 'badge'
                },
                method: {
                    type: 'string',
                    default: 'totp',
                    enum: ['totp'],
                    adminCard: { visible: false },
                    userCard: { visible: false }
                },
                secret: {
                    type: 'string',
                    default: '',
                    adminCard: { visible: false },
                    userCard: { visible: false }
                },
                backupCodes: {
                    type: 'array',
                    default: [],
                    label: 'Backup Codes',
                    adminCard: { visible: true, readOnly: true },
                    userCard: { visible: true, readOnly: true },
                    displayAs: 'count'
                },
                enrolledAt: {
                    type: 'date',
                    default: null,
                    label: 'Enrolled',
                    adminCard: { visible: true, readOnly: true },
                    userCard: { visible: true, readOnly: true },
                    displayAs: 'date',
                    showIf: 'hasValue'
                },
                lastUsedAt: {
                    type: 'date',
                    default: null,
                    label: 'Last Used',
                    adminCard: { visible: true, readOnly: true },
                    userCard: { visible: true, readOnly: true },
                    displayAs: 'date',
                    showIf: 'hasValue'
                },
                failedAttempts: {
                    type: 'number',
                    default: 0,
                    label: 'Failed Attempts',
                    adminCard: { visible: true, readOnly: true },
                    userCard: { visible: false },
                    showIf: { field: 'mfa.failedAttempts', condition: 'gt', value: 0 }
                },
                lockedUntil: {
                    type: 'date',
                    default: null,
                    label: 'Locked Until',
                    adminCard: { visible: true, readOnly: true },
                    userCard: { visible: false },
                    displayAs: 'datetime',
                    showIf: 'hasValue'
                },
                gracePeriodUntil: {
                    type: 'date',
                    default: null,
                    adminCard: { visible: false },
                    userCard: { visible: false }
                }
            }
        });
    }

    // ========================================================================
    // Configuration
    // ========================================================================

    /**
     * Get plugin configuration
     * @returns {object} Plugin config with defaults applied
     */
    static async getConfig() {
        if (!PluginModel) {
            return this.getDefaultConfig();
        }

        try {
            const pluginDoc = await PluginModel.getByName('auth-mfa');
            const config = pluginDoc?.config || {};
            return {
                ...this.getDefaultConfig(),
                ...config
            };
        } catch (error) {
            return this.getDefaultConfig();
        }
    }

    /**
     * Get default configuration values
     * @returns {object} Default config
     */
    static getDefaultConfig() {
        return {
            mfaPolicy: 'optional',
            requiredRoles: ['root'],
            gracePeriodDays: 7,
            issuerName: 'jPulse',
            maxFailedAttempts: 5,
            lockoutDuration: 15,
            backupCodeCount: 10
        };
    }

    // ========================================================================
    // Encryption / Decryption
    // ========================================================================

    /**
     * Get encryption key from app config
     * @returns {Buffer} 32-byte encryption key
     */
    static getEncryptionKey() {
        // Use app's session secret as base for encryption key
        const secret = global.appConfig?.security?.sessionSecret || 'jpulse-default-secret-change-me';
        return crypto.scryptSync(secret, 'mfa-salt', 32);
    }

    /**
     * Encrypt a string (for TOTP secret storage)
     * @param {string} text - Plain text to encrypt
     * @returns {string} Encrypted string (base64)
     */
    static encrypt(text) {
        if (!text) return '';

        const key = this.getEncryptionKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        // Combine iv + authTag + encrypted data
        return Buffer.concat([
            iv,
            authTag,
            Buffer.from(encrypted, 'base64')
        ]).toString('base64');
    }

    /**
     * Decrypt a string
     * @param {string} encryptedText - Encrypted string (base64)
     * @returns {string} Decrypted plain text
     */
    static decrypt(encryptedText) {
        if (!encryptedText) return '';

        try {
            const key = this.getEncryptionKey();
            const data = Buffer.from(encryptedText, 'base64');

            const iv = data.subarray(0, 16);
            const authTag = data.subarray(16, 32);
            const encrypted = data.subarray(32);

            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, null, 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error('MfaAuthModel: Decryption failed:', error.message);
            return '';
        }
    }

    // ========================================================================
    // Backup Codes
    // ========================================================================

    /**
     * Generate backup codes
     * @param {number} count - Number of codes to generate
     * @returns {object} { codes: string[], hashes: string[] }
     */
    static generateBackupCodes(count = 10) {
        const codes = [];
        const hashes = [];

        for (let i = 0; i < count; i++) {
            // Generate 8 character code: XXXX-XXXX
            const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
            const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
            const code = `${part1}-${part2}`;

            codes.push(code);
            // Store hash for verification (bcrypt-style but using crypto)
            hashes.push(this.hashBackupCode(code));
        }

        return { codes, hashes };
    }

    /**
     * Hash a backup code for storage
     * @param {string} code - Plain backup code
     * @returns {string} Hashed code
     */
    static hashBackupCode(code) {
        // Normalize code (remove dashes, uppercase)
        const normalized = code.replace(/-/g, '').toUpperCase();
        return crypto
            .createHash('sha256')
            .update(normalized + 'mfa-backup-salt')
            .digest('hex');
    }

    /**
     * Verify a backup code against stored hashes
     * @param {string} code - Code to verify
     * @param {string[]} hashes - Stored hashes
     * @returns {number} Index of matched hash, or -1 if not found
     */
    static verifyBackupCode(code, hashes) {
        const inputHash = this.hashBackupCode(code);

        for (let i = 0; i < hashes.length; i++) {
            // Constant-time comparison
            if (crypto.timingSafeEqual(
                Buffer.from(inputHash),
                Buffer.from(hashes[i])
            )) {
                return i;
            }
        }

        return -1;
    }

    // ========================================================================
    // User MFA Operations
    // ========================================================================

    /**
     * Get user's MFA status
     * @param {string} userId - User ID
     * @returns {object} MFA status
     */
    static async getUserMfaStatus(userId) {
        try {
            if (!global.UserModel) {
                throw new Error('global.UserModel not available');
            }

            const user = await global.UserModel.findById(userId);
            if (!user) {
                return { enabled: false, exists: false };
            }

            const mfa = user.mfa || {};

            return {
                exists: true,
                enabled: mfa.enabled || false,
                method: mfa.method || 'totp',
                enrolledAt: mfa.enrolledAt || null,
                lastUsedAt: mfa.lastUsedAt || null,
                hasBackupCodes: (mfa.backupCodes || []).length > 0,
                backupCodesCount: (mfa.backupCodes || []).length,
                isLocked: mfa.lockedUntil && new Date() < new Date(mfa.lockedUntil),
                lockedUntil: mfa.lockedUntil || null,
                failedAttempts: mfa.failedAttempts || 0
            };
        } catch (error) {
            throw new Error(`Failed to get MFA status: ${error.message}`);
        }
    }

    /**
     * Check if MFA is required for user based on policy
     * @param {object} user - User object
     * @returns {object} { required: boolean, reason: string }
     */
    static async isMfaRequired(user) {
        const config = await this.getConfig();

        // If MFA is already enabled, it's always required
        if (user.mfa?.enabled) {
            return { required: true, reason: 'enabled' };
        }

        // Check policy
        switch (config.mfaPolicy) {
            case 'required':
                // Check grace period
                if (user.mfa?.gracePeriodUntil && new Date() < new Date(user.mfa.gracePeriodUntil)) {
                    return { required: false, reason: 'grace-period' };
                }
                return { required: true, reason: 'policy-required' };

            case 'required-for-roles':
                const userRoles = user.roles || ['user'];
                const requiredRoles = config.requiredRoles || [];
                const hasRequiredRole = userRoles.some(role => requiredRoles.includes(role));

                if (hasRequiredRole) {
                    // Check grace period
                    if (user.mfa?.gracePeriodUntil && new Date() < new Date(user.mfa.gracePeriodUntil)) {
                        return { required: false, reason: 'grace-period' };
                    }
                    return { required: true, reason: 'role-required' };
                }
                return { required: false, reason: 'optional' };

            case 'optional':
            default:
                return { required: false, reason: 'optional' };
        }
    }

    /**
     * Save user's MFA secret and enable MFA
     * @param {string} userId - User ID
     * @param {string} secret - Plain TOTP secret
     * @returns {object} { success: boolean, backupCodes?: string[] }
     */
    static async enableMfa(userId, secret) {
        try {
            if (!global.UserModel) {
                throw new Error('global.UserModel not initialized');
            }

            const config = await this.getConfig();
            const { codes, hashes } = this.generateBackupCodes(config.backupCodeCount);

            await global.UserModel.updateById(userId, {
                'mfa.enabled': true,
                'mfa.method': 'totp',
                'mfa.secret': this.encrypt(secret),
                'mfa.backupCodes': hashes,
                'mfa.enrolledAt': new Date(),
                'mfa.failedAttempts': 0,
                'mfa.lockedUntil': null
            });

            return { success: true, backupCodes: codes };
        } catch (error) {
            throw new Error(`Failed to enable MFA: ${error.message}`);
        }
    }

    /**
     * Disable user's MFA
     * @param {string} userId - User ID
     * @returns {boolean} Success
     */
    static async disableMfa(userId) {
        try {
            if (!global.UserModel) {
                throw new Error('global.UserModel not initialized');
            }

            await global.UserModel.updateById(userId, {
                'mfa.enabled': false,
                'mfa.secret': '',
                'mfa.backupCodes': [],
                'mfa.enrolledAt': null,
                'mfa.failedAttempts': 0,
                'mfa.lockedUntil': null
            });

            return true;
        } catch (error) {
            throw new Error(`Failed to disable MFA: ${error.message}`);
        }
    }

    /**
     * Record successful MFA verification
     * @param {string} userId - User ID
     */
    static async recordSuccess(userId) {
        if (!global.UserModel) return;

        await global.UserModel.updateById(userId, {
            'mfa.lastUsedAt': new Date(),
            'mfa.failedAttempts': 0,
            'mfa.lockedUntil': null
        });
    }

    /**
     * Record failed MFA attempt
     * @param {string} userId - User ID
     * @returns {object} { locked: boolean, lockedUntil?: Date, attempts: number }
     */
    static async recordFailure(userId) {
        if (!global.UserModel) {
            return { locked: false, attempts: 0 };
        }

        const config = await this.getConfig();
        const user = await global.UserModel.findById(userId);
        const currentAttempts = (user?.mfa?.failedAttempts || 0) + 1;

        const updates = {
            'mfa.failedAttempts': currentAttempts
        };

        let locked = false;
        let lockedUntil = null;

        if (currentAttempts >= config.maxFailedAttempts) {
            lockedUntil = new Date(Date.now() + config.lockoutDuration * 60 * 1000);
            updates['mfa.lockedUntil'] = lockedUntil;
            locked = true;
        }

        await global.UserModel.updateById(userId, updates);

        return { locked, lockedUntil, attempts: currentAttempts };
    }

    /**
     * Check if user is locked out
     * @param {object} user - User object
     * @returns {object} { locked: boolean, lockedUntil?: Date, remainingMinutes?: number }
     */
    static isLocked(user) {
        const lockedUntil = user?.mfa?.lockedUntil;
        if (!lockedUntil) {
            return { locked: false };
        }

        const lockDate = new Date(lockedUntil);
        const now = new Date();

        if (now >= lockDate) {
            return { locked: false };
        }

        const remainingMs = lockDate - now;
        const remainingMinutes = Math.ceil(remainingMs / 60000);

        return {
            locked: true,
            lockedUntil: lockDate,
            remainingMinutes
        };
    }

    /**
     * Use a backup code (removes it after use)
     * @param {string} userId - User ID
     * @param {string} code - Backup code
     * @returns {boolean} True if code was valid
     */
    static async useBackupCode(userId, code) {
        if (!global.UserModel) {
            return false;
        }

        const user = await global.UserModel.findById(userId);
        const hashes = user?.mfa?.backupCodes || [];

        const index = this.verifyBackupCode(code, hashes);
        if (index === -1) {
            return false;
        }

        // Remove used code
        hashes.splice(index, 1);

        await global.UserModel.updateById(userId, {
            'mfa.backupCodes': hashes,
            'mfa.lastUsedAt': new Date(),
            'mfa.failedAttempts': 0,
            'mfa.lockedUntil': null
        });

        return true;
    }

    /**
     * Regenerate backup codes
     * @param {string} userId - User ID
     * @returns {string[]} New backup codes (plain text)
     */
    static async regenerateBackupCodes(userId) {
        try {
            if (!global.UserModel) {
                throw new Error('global.UserModel not initialized');
            }

            const config = await this.getConfig();
            const { codes, hashes } = this.generateBackupCodes(config.backupCodeCount);

            await global.UserModel.updateById(userId, {
                'mfa.backupCodes': hashes
            });

            return codes;
        } catch (error) {
            throw new Error(`Failed to regenerate backup codes: ${error.message}`);
        }
    }

    /**
     * Get decrypted TOTP secret for user
     * @param {object} user - User object with mfa.secret
     * @returns {string} Plain TOTP secret
     */
    static getDecryptedSecret(user) {
        if (!user?.mfa?.secret) {
            return '';
        }
        return this.decrypt(user.mfa.secret);
    }
}

export default MfaAuthModel;

// EOF plugins/auth-mfa/webapp/model/mfaAuth.js
