import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "@/components/layout/AppLayout.jsx";
import ProtectedRoute from "@/components/routing/ProtectedRoute";
import RouteLoading from "@/components/routing/RouteLoading";

const CellarPage = lazy(() => import("@/pages/CellarPage"));
const DemoCellarPage = lazy(() => import("@/pages/DemoCellarPage"));
const DemoTasteAtlasPage = lazy(() => import("@/pages/DemoTasteAtlasPage"));
const DiscoverPage = lazy(() => import("@/pages/DiscoverPage.jsx"));
const HomePage = lazy(() => import("@/pages/HomePage.jsx"));
const LoginPage = lazy(() => import("@/pages/LoginPage.jsx"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage.jsx"));
const SignupPage = lazy(() => import("@/pages/SignupPage.jsx"));
const WineDetailPage = lazy(() => import("@/pages/WineDetailPage.jsx"));

function SuspendedRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<SuspendedRoute><HomePage /></SuspendedRoute>} />
        <Route path="/discover" element={<SuspendedRoute><DiscoverPage /></SuspendedRoute>} />
        <Route path="/wines/:wineId" element={<SuspendedRoute><WineDetailPage /></SuspendedRoute>} />
        <Route path="/demo/cellar" element={<SuspendedRoute><DemoCellarPage /></SuspendedRoute>} />
        <Route path="/demo/taste-atlas" element={<SuspendedRoute><DemoTasteAtlasPage /></SuspendedRoute>} />
        <Route
          path="/cellar"
          element={
            <ProtectedRoute>
              <SuspendedRoute><CellarPage /></SuspendedRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<SuspendedRoute><LoginPage /></SuspendedRoute>} />
        <Route path="/signup" element={<SuspendedRoute><SignupPage /></SuspendedRoute>} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <SuspendedRoute><ProfilePage /></SuspendedRoute>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
