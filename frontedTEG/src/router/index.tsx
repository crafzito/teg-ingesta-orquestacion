import { Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Route, createRoutesFromElements } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { appRoutes } from './routes'
import LoginPage from '../pages/LoginPage'

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {appRoutes.map(({ path, element: Element }) => (
            <Route
              key={path}
              path={path}
              element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Element />
                </Suspense>
              }
            />
          ))}
        </Route>
      </Route>
    </>
  )
)

export function AppRouter() {
  return <RouterProvider router={router} />
}
