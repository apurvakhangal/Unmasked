import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { AppLayout } from "@/components/app-layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import News from "./pages/News";
import History from "./pages/History";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminContent from "./pages/AdminContent";
import SupportCenter from "./pages/SupportCenter";
import TrackComplaint from "./pages/TrackComplaint";
import AwarenessBlogs from "./pages/AwarenessBlogs";
import BlogDetail from "./pages/BlogDetail";
import Forum from "./pages/Forum";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="unmasked-ui-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              
              {/* Protected routes with layout */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <AppLayout><Dashboard /></AppLayout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/upload" 
                element={
                  <ProtectedRoute>
                    <AppLayout><Upload /></AppLayout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/reports" 
                element={
                  <ProtectedRoute>
                    <AppLayout><Reports /></AppLayout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/history" 
                element={
                  <ProtectedRoute>
                    <AppLayout><History /></AppLayout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <AppLayout><Profile /></AppLayout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/support" 
                element={
                  <ProtectedRoute>
                    <AppLayout><SupportCenter /></AppLayout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/track-complaint" 
                element={
                  <ProtectedRoute>
                    <AppLayout><TrackComplaint /></AppLayout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/blogs" 
                element={
                  <ProtectedRoute>
                    <AppLayout><AwarenessBlogs /></AppLayout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/blogs/:id" 
                element={
                  <ProtectedRoute>
                    <AppLayout><BlogDetail /></AppLayout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/forum" 
                element={
                  <ProtectedRoute>
                    <AppLayout><Forum /></AppLayout>
                  </ProtectedRoute>
                } 
              />
              {/* Public route - no authentication required */}
              <Route 
                path="/news" 
                element={
                  <AppLayout>
                    <News />
                  </AppLayout>
                } 
              />
              
              {/* Admin-only routes */}
              <Route 
                path="/admin/dashboard" 
                element={
                  <AdminRoute>
                    <AppLayout><AdminDashboard /></AppLayout>
                  </AdminRoute>
                } 
              />
              <Route 
                path="/admin/users" 
                element={
                  <AdminRoute>
                    <AppLayout><AdminUsers /></AppLayout>
                  </AdminRoute>
                } 
              />
              <Route 
                path="/admin/content" 
                element={
                  <AdminRoute>
                    <AppLayout><AdminContent /></AppLayout>
                  </AdminRoute>
                } 
              />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
