import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout.jsx";
import ProtectedRoute from "./components/routing/ProtectedRoute.jsx";
import CellarPage from "./pages/CellarPage.jsx";
import DiscoverPage from "./pages/DiscoverPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import WineDetailPage from "./pages/WineDetailPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/wines/:wineId" element={<WineDetailPage />} />
        <Route
          path="/cellar"
          element={
            <ProtectedRoute>
              <CellarPage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
