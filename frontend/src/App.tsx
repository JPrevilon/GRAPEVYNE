import { lazy, Suspense, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";

import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/routing/ProtectedRoute";
import RouteLoading from "@/components/routing/RouteLoading";

const CellarPage = lazy(() => import("@/pages/CellarPage"));
const DemoCellarPage = lazy(() => import("@/pages/DemoCellarPage"));
const DemoTasteAtlasPage = lazy(() => import("@/pages/DemoTasteAtlasPage"));
const DiscoverPage = lazy(() => import("@/pages/DiscoverPage"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const SignupPage = lazy(() => import("@/pages/SignupPage"));
const WineDetailPage = lazy(() => import("@/pages/WineDetailPage"));

function HomeRouteLoading() {
  return (
    <div className="home-route-loading-reservation">
      <RouteLoading />
    </div>
  );
}

function SuspendedRoute({
  children,
  fallback = <RouteLoading />,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          index
          element={
            <SuspendedRoute fallback={<HomeRouteLoading />}>
              <HomePage />
            </SuspendedRoute>
          }
        />
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
        <Route path="*" element={<SuspendedRoute><NotFoundPage /></SuspendedRoute>} />
      </Route>
    </Routes>
  );
}
