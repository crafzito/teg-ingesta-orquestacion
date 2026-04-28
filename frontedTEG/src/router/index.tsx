import { Suspense, lazy } from 'react'
import { Navigate, Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from 'react-router-dom'

import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import LoginPage from '../pages/LoginPage'
import UnauthorizedPage from '../pages/UnauthorizedPage'
import { ProtectedRoute } from './ProtectedRoute'
import { appRoutes } from './routes'

const ManualPage = lazy(() => import('../pages/ManualPage'))
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'))

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route
        path="/manual"
        element={
          <Suspense fallback={<LoadingSpinner className="min-h-screen" />}>
            <ManualPage />
          </Suspense>
        }
      />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/forgot-password"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <ForgotPasswordPage />
            </Suspense>
          }
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          {appRoutes.map(({ path, element: Element, allowedRoles }) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute allowedRoles={allowedRoles}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <Element />
                  </Suspense>
                </ProtectedRoute>
              }
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </>,
  ),
)

export function AppRouter() {
  return <RouterProvider router={router} />
}
