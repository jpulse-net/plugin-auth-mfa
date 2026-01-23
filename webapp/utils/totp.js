/**
 * @name            jPulse Framework / Plugins / Auth-MFA / WebApp / Utils / TOTP
 * @tagline         TOTP Implementation
 * @description     Minimal TOTP implementation (RFC6238) with Base32 secrets (RFC4648)
 * @file            plugins/auth-mfa/webapp/utils/totp.js
 * @version         1.0.4
 * @release         2026-01-23
 * @repository      https://github.com/jpulse-net/plugin-auth-mfa
 * @author          Peter Thoeny, https://twiki.org & https://github.com/peterthoeny/
 * @copyright       2025 Peter Thoeny, https://twiki.org & https://github.com/peterthoeny/
 * @license         BSL 1.1 -- see LICENSE file; for commercial use: team@jpulse.net
 * @genai           80%, Cursor 2.3, Claude Sonnet 4.5
*/

/**
 * Goals:
 * - Zero external runtime dependencies (uses Node.js built-in `crypto`)
 * - Compatible with common authenticator apps (Google Authenticator, Authy, etc.)
 * - Keep UX stable (QR code + 6-digit code entry)
 *
 * Notes:
 * - Secrets are Base32, unpadded, uppercase (common in authenticator apps)
 * - Default algorithm SHA1, 6 digits, 30s period (standard)
 */

import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function _base32Encode(bytes) {
    let bits = 0;
    let value = 0;
    let output = '';

    for (const b of bytes) {
        value = (value << 8) | (b & 0xff);
        bits += 8;
        while (bits >= 5) {
            const index = (value >>> (bits - 5)) & 31;
            output += BASE32_ALPHABET[index];
            bits -= 5;
        }
    }

    if (bits > 0) {
        const index = (value << (5 - bits)) & 31;
        output += BASE32_ALPHABET[index];
    }

    return output;
}

function _base32Decode(base32) {
    const clean = (base32 || '')
        .toString()
        .trim()
        .toUpperCase()
        .replace(/=+$/g, '')
        .replace(/[\s-]/g, '');

    let bits = 0;
    let value = 0;
    const out = [];

    for (const ch of clean) {
        const idx = BASE32_ALPHABET.indexOf(ch);
        if (idx === -1) {
            throw new Error(`Invalid Base32 character: ${ch}`);
        }

        value = (value << 5) | idx;
        bits += 5;

        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }

    return Buffer.from(out);
}

function _hotp(keyBytes, counter, digits = 6, algorithm = 'sha1') {
    const counterBuf = Buffer.alloc(8);

    let tmp = BigInt(counter);
    for (let i = 7; i >= 0; i -= 1) {
        counterBuf[i] = Number(tmp & 0xffn);
        tmp >>= 8n;
    }

    const hmac = crypto.createHmac(algorithm.toLowerCase(), keyBytes).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    );

    const mod = 10 ** digits;
    const token = (code % mod).toString().padStart(digits, '0');
    return token;
}

function _timingSafeEqualString(a, b) {
    const aBuf = Buffer.from((a || '').toString());
    const bBuf = Buffer.from((b || '').toString());
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
}

export function normalizeTotpToken(token) {
    return (token || '').toString().replace(/\s/g, '');
}

export function generateTotpSecret(numBytes = 20) {
    const bytes = crypto.randomBytes(numBytes);
    return _base32Encode(bytes);
}

export function buildOtpAuthUri({ issuer, label, secret, digits = 6, period = 30, algorithm = 'SHA1' }) {
    const safeIssuer = (issuer || '').toString();
    const safeLabel = (label || '').toString();
    const safeSecret = (secret || '').toString().replace(/\s/g, '').toUpperCase();

    // Standard label format: issuer:label
    const pathLabel = safeIssuer ? `${safeIssuer}:${safeLabel}` : safeLabel;

    // Encode path segment carefully; keep ':' unescaped for readability (apps accept both).
    const encodedPath = encodeURIComponent(pathLabel).replace(/%3A/g, ':');

    const params = new URLSearchParams();
    params.set('secret', safeSecret);
    if (safeIssuer) {
        params.set('issuer', safeIssuer);
    }
    params.set('algorithm', algorithm);
    params.set('digits', String(digits));
    params.set('period', String(period));

    return `otpauth://totp/${encodedPath}?${params.toString()}`;
}

export function verifyTotpToken({
    token,
    secret,
    window = 1,
    period = 30,
    digits = 6,
    algorithm = 'sha1',
    nowMs = Date.now()
}) {
    const cleanToken = normalizeTotpToken(token);
    if (!/^\d+$/.test(cleanToken)) {
        return false;
    }
    if (cleanToken.length !== digits) {
        return false;
    }

    const keyBytes = _base32Decode(secret);
    const counter = Math.floor(nowMs / 1000 / period);

    for (let w = -window; w <= window; w += 1) {
        const expected = _hotp(keyBytes, counter + w, digits, algorithm);
        if (_timingSafeEqualString(expected, cleanToken)) {
            return true;
        }
    }

    return false;
}

// EOF plugins/auth-mfa/webapp/utils/totp.js
