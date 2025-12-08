/*
 * @name            jPulse Framework / Plugins / Auth-MFA / WebApp / View / jPulse Common JavaScript
 * @tagline         Common JavaScript of the Auth-MFA Plugin
 * @description     Common JavaScript for the Auth-MFA Plugin, appended to the framework common JavaScript
 * @file            plugins/auth-mfa/webapp/view/jpulse-common.js
 * @version         0.9.0
 * @release         2025-12-07
 * @repository      https://github.com/jpulse-net/plugin-auth-mfa
 * @author          Peter Thoeny, https://twiki.org & https://github.com/peterthoeny/
 * @copyright       2025 Peter Thoeny, https://twiki.org & https://github.com/peterthoeny/
 * @license         BSL 1.1 -- see LICENSE file; for commercial use: team@jpulse.net
 * @genai           80%, Cursor 2.1, Claude Sonnet 4.5
 */

/**
 * Auth-MFA Plugin JavaScript (W-098 Append Mode)
 * This file is automatically appended to the framework's jpulse-common.js
 * Namespace: window.jPulse.plugins.authMfa
 */

// Ensure plugin namespace exists (framework defines jPulse.plugins = {})
if (!window.jPulse) {
    window.jPulse = {};
}
if (!window.jPulse.plugins) {
    window.jPulse.plugins = {};
}
// W-107: Schema action handlers namespace
if (!window.jPulse.schemaHandlers) {
    window.jPulse.schemaHandlers = {};
}

/**
 * Auth-MFA plugin namespace
 */
window.jPulse.plugins.authMfa = {
    /**
     * Get MFA status for current user
     * @returns {Promise<object>} MFA status
     */
    getStatus: async function() {
        try {
            const response = await jPulse.api.get('/api/1/auth-mfa/status');
            if (response.success) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error('[Auth-MFA] Error getting MFA status:', error);
            return null;
        }
    },

    /**
     * Check if MFA is enabled for current user
     * @returns {Promise<boolean>} True if MFA is enabled
     */
    isEnabled: async function() {
        const status = await this.getStatus();
        return status?.enabled || false;
    },

    /**
     * Check if MFA is required by policy
     * @returns {Promise<boolean>} True if MFA is required
     */
    isRequired: async function() {
        const status = await this.getStatus();
        return status?.policyRequired || false;
    },

    /**
     * Start MFA setup flow
     * @returns {Promise<object>} Setup data with QR code
     */
    startSetup: async function() {
        try {
            const response = await jPulse.api.post('/api/1/auth-mfa/setup');
            if (response.success) {
                return response.data;
            }
            throw new Error(response.error || 'Failed to start MFA setup');
        } catch (error) {
            console.error('[Auth-MFA] Error starting setup:', error);
            throw error;
        }
    },

    /**
     * Verify setup code and enable MFA
     * @param {string} code - 6-digit TOTP code
     * @returns {Promise<object>} Result with backup codes
     */
    verifySetup: async function(code) {
        try {
            const response = await jPulse.api.post('/api/1/auth-mfa/verify-setup', { code });
            if (response.success) {
                return response.data;
            }
            throw new Error(response.error || 'Invalid verification code');
        } catch (error) {
            console.error('[Auth-MFA] Error verifying setup:', error);
            throw error;
        }
    },

    /**
     * Disable MFA for current user
     * @param {string} password - User's password for confirmation
     * @returns {Promise<boolean>} True if disabled successfully
     */
    disable: async function(password) {
        try {
            const response = await jPulse.api.post('/api/1/auth-mfa/disable', { password });
            return response.success;
        } catch (error) {
            console.error('[Auth-MFA] Error disabling MFA:', error);
            return false;
        }
    },

    /**
     * Regenerate backup codes
     * @returns {Promise<string[]>} New backup codes
     */
    regenerateBackupCodes: async function() {
        try {
            const response = await jPulse.api.post('/api/1/auth-mfa/backup-codes');
            if (response.success) {
                return response.data.backupCodes;
            }
            throw new Error(response.error || 'Failed to regenerate backup codes');
        } catch (error) {
            console.error('[Auth-MFA] Error regenerating backup codes:', error);
            throw error;
        }
    },

    /**
     * Plugin utility functions
     */
    utils: {
        /**
         * Format backup code for display (add dash if missing)
         * @param {string} code - Backup code
         * @returns {string} Formatted code
         */
        formatBackupCode: function(code) {
            const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (clean.length === 8) {
                return clean.slice(0, 4) + '-' + clean.slice(4);
            }
            return code;
        },

        /**
         * Download backup codes as text file
         * @param {string[]} codes - Array of backup codes
         * @param {string} [email] - Optional user email for account identification
         */
        downloadBackupCodes: function(codes, email) {
            // Get email from jPulse.user if available and not passed
            const userEmail = email || window.jPulse?.user?.email || '';
            const appName = window.jPulse?.appConfig?.app?.site?.shortName || 'jPulse';

            let text = 'jPulse MFA Backup Codes\n' +
                       '========================\n\n';

            // Add account identifier if email is available
            if (userEmail) {
                text += `Account ID: ${appName}: ${userEmail}\n\n`;
            }

            text += 'Each code can only be used once.\n' +
                    'Store these in a safe place.\n\n' +
                    codes.join('\n');

            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'jpulse-mfa-backup-codes.txt';
            a.click();
            URL.revokeObjectURL(url);
        },

        /**
         * Copy backup codes to clipboard
         * @param {string[]} codes - Array of backup codes
         * @returns {Promise<boolean>} True if copied
         */
        copyBackupCodes: async function(codes) {
            try {
                await navigator.clipboard.writeText(codes.join('\n'));
                return true;
            } catch (error) {
                console.error('[Auth-MFA] Error copying to clipboard:', error);
                return false;
            }
        },

        /**
         * Log plugin message
         * @param {string} message - Message to log
         */
        log: function(message) {
            console.log(`[Auth-MFA Plugin] ${message}`);
        }
    }
};

// ============================================================================
// W-107: Schema Action Handlers
// These handlers are called by data-driven profile cards for complex actions
// ============================================================================

/**
 * W-107: Regenerate backup codes handler
 * Called when user clicks "New Backup Codes" button in profile
 * @param {object} userData - Current user data
 * @param {object} action - Action definition from schema
 * @returns {object} { refresh: true } to reload data after completion
 */
window.jPulse.schemaHandlers['mfa.regenerateBackupCodes'] = async function(userData, action) {
    // 1. Confirm action
    const confirm = await jPulse.UI.confirmDialog({
        title: 'Generate New Backup Codes',
        message: 'Your old backup codes will stop working. Continue?',
        buttons: ['Cancel', 'Generate']
    });
    if (confirm.button !== 'Generate') {
        return { cancelled: true };
    }

    // 2. Call API - server generates and stores hashed codes
    try {
        const result = await jPulse.api.post('/api/1/auth-mfa/backup-codes');
        if (!result.success) {
            jPulse.UI.toast.error(result.error || 'Failed to generate backup codes');
            return { error: true };
        }

        const codes = result.data?.codes || result.data?.backupCodes || [];

        // 3. Show codes to user with download option
        const codesHtml = codes.map(code => `<code>${code}</code>`).join('<br>');

        // Use confirmDialog for buttons with download option
        const showCodesResult = await jPulse.UI.confirmDialog({
            title: 'New Backup Codes',
            message: `
                <p><strong>Save these codes in a safe place!</strong></p>
                <p>Each code can only be used once.</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; font-family: monospace; margin: 15px 0;">
                    ${codesHtml}
                </div>
            `,
            buttons: ['OK', 'Download']
        });

        // 4. Download if requested
        if (showCodesResult.button === 'Download') {
            window.jPulse.plugins.authMfa.utils.downloadBackupCodes(codes, userData.email);
            jPulse.UI.toast.success('Backup codes downloaded');
        }

        // 5. Tell UI to refresh the card (backup count changed)
        return { refresh: true };
    } catch (error) {
        console.error('[Auth-MFA] Error regenerating backup codes:', error);
        jPulse.UI.toast.error('Failed to generate backup codes: ' + error.message);
        return { error: true };
    }
};

// EOF plugins/auth-mfa/webapp/view/jpulse-common.js

