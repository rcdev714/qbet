import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "@/contexts/auth-context";
import { BetaWelcomePage } from "@/pages/beta-welcome";
import { HomePage } from "@/pages/home";
import { LoginPage } from "@/pages/login";
import { RequestAccessPage } from "@/pages/request-access";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/request-access" element={<RequestAccessPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/beta/welcome" element={<BetaWelcomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
