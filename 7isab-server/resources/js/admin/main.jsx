import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router';

import { AuthProvider, useAuth } from './auth';
import { I18nProvider } from './i18n';
import Layout from './Layout';
import Admins from './pages/Admins';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import UserDetail from './pages/UserDetail';
import Users from './pages/Users';
import { Spinner } from './ui';

function RequireAdmin() {
    const { status } = useAuth();
    if (status === 'loading') return <Spinner />;
    if (status !== 'signedIn') return <Login />;
    return <Outlet />;
}

function RequireSuperAdmin({ children }) {
    const { isSuperAdmin } = useAuth();
    return isSuperAdmin ? children : <Navigate to="/admin" replace />;
}

const router = createBrowserRouter([
    {
        path: '/admin',
        element: <RequireAdmin />,
        children: [
            {
                element: <Layout />,
                children: [
                    { index: true, element: <Dashboard /> },
                    { path: 'users', element: <Users /> },
                    { path: 'users/:id', element: <UserDetail /> },
                    {
                        path: 'admins',
                        element: (
                            <RequireSuperAdmin>
                                <Admins />
                            </RequireSuperAdmin>
                        ),
                    },
                    { path: '*', element: <Navigate to="/admin" replace /> },
                ],
            },
        ],
    },
]);

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <I18nProvider>
            <AuthProvider>
                <RouterProvider router={router} />
            </AuthProvider>
        </I18nProvider>
    </StrictMode>,
);
