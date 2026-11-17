/**
 * Admin API client (/api/v1/admin). Responses use the envelope
 * { success, message, ...data }; failures throw ApiError.
 */
const BASE = '/api/v1/admin';
const TOKEN_KEY = 'hisab.admin.token';

export class ApiError extends Error {
    constructor(message, status, errors = {}) {
        super(message);
        this.status = status;
        this.errors = errors;
    }
}

export function getToken() {
    try {
        return sessionStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setToken(token) {
    try {
        if (token) sessionStorage.setItem(TOKEN_KEY, token);
        else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
        // Storage blocked: the session lasts until the page reloads.
    }
}

let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler) {
    onUnauthorized = handler;
}

export async function api(path, { method = 'GET', body, query } = {}) {
    const url = new URL(BASE + path, window.location.origin);
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }

    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
        response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
        throw new ApiError('network', 0);
    }

    let data = {};
    try {
        data = await response.json();
    } catch {
        // Empty or non-JSON body.
    }

    if (response.status === 401 && token) onUnauthorized();
    if (!response.ok || data.success === false) {
        throw new ApiError(data.message ?? response.statusText, response.status, data.errors ?? {});
    }
    return data;
}
