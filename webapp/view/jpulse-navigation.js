/*
 * @name            jPulse Framework / Plugins / Auth-MFA / WebApp / View / jPulse Navigation
 * @tagline         Navigation of the Auth-MFA Plugin
 * @description     Navigation for the Auth-MFA Plugin, appended to the framework navigation
 * @file            plugins/auth-mfa/webapp/view/jpulse-navigation.js
 * @version         0.9.0
 * @release         2025-12-07
 * @repository      https://github.com/jpulse-net/plugin-auth-mfa
 * @author          Peter Thoeny, https://twiki.org & https://github.com/peterthoeny/
 * @copyright       2025 Peter Thoeny, https://twiki.org & https://github.com/peterthoeny/
 * @license         BSL 1.1 -- see LICENSE file; for commercial use: team@jpulse.net
 * @genai           80%, Cursor 2.1, Claude Sonnet 4.5
 */

/**
 * Auth-MFA Plugin - Navigation Integration
 * This file is appended to framework navigation (W-098 append mode)
 */

// Add Auth-MFA to jPulse Plugins section
if (window.jPulseNavigation?.site?.jPulsePlugins) {
    window.jPulseNavigation.site.jPulsePlugins.pages.authMfa = {
        label: 'MFA Settings',
        url: '/jpulse-plugins/auth-mfa.shtml',
        icon: '🔐'
    };
}

// Add MFA Setup to auth-related navigation (if exists)
if (window.jPulseNavigation?.site?.siteAccount) {
    window.jPulseNavigation.site.siteAccount.pages.mfaSetup = {
        label: 'Two-Factor Auth',
        url: '/auth/mfa-setup',
        icon: '🔐'
    };
}

// EOF plugins/auth-mfa/webapp/view/jpulse-navigation.js

