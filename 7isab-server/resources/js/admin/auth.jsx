import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, getToken, setToken, setUnauthorizedHandler } from './api';

const AuthContext = createContext(null);

/** Admin session: token in sessionStorage (cleared when the tab closes). */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [status, setStatus] = useState(getToken() ? 'loading' : 'signedOut');

    const clear = useCallback(() => {
        setToken(null);
        setUser(null);
        setStatus('signedOut');
    }, []);

    useEffect(() => {
        setUnauthorizedHandler(clear);
        if (!getToken()) return;
        api('/auth/me')
            .then((data) => {
                setUser(data.user);
                setStatus('signedIn');
            })
            .catch(clear);
    }, [clear]);

    const signIn = useCallback(async (email, password) => {
        const data = await api('/auth/login', { method: 'POST', body: { email, password } });
        setToken(data.token);
        setUser(data.user);
        setStatus('signedIn');
    }, []);

    const signOut = useCallback(async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        clear();
    }, [clear]);

    const value = useMemo(
        () => ({ user, status, signIn, signOut, isSuperAdmin: user?.role === 'super-admin' }),
        [user, status, signIn, signOut],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
