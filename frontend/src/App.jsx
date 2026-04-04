import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
// import your pages here

const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const ForbiddenPage = React.lazy(() => import('./pages/ForbiddenPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));
const DashboardPage = React.lazy(() => import('./pages/gestionnaire/DashboardPage'));
const StockPage = React.lazy(() => import('./pages/gestionnaire/StockPage'));
const MouvementsPage = React.lazy(() => import('./pages/gestionnaire/MouvementsPage'));
const MarchesListPage = React.lazy(() => import('./pages/shared/MarchesListPage'));
const MarcheDetailPage = React.lazy(() => import('./pages/shared/MarcheDetailPage'));
const StagingReviewPage = React.lazy(() => import('./pages/gestionnaire/StagingReviewPage'));
const DemandesListPage = React.lazy(() => import('./pages/gestionnaire/DemandesListPage'));
const DemandeDetailPage = React.lazy(() => import('./pages/gestionnaire/DemandeDetailPage'));
const DechargeCreatePage = React.lazy(() => import('./pages/gestionnaire/DechargeCreatePage'));
const DechargeDetailPage = React.lazy(() => import('./pages/gestionnaire/DechargeDetailPage'));
const DechargesListPage = React.lazy(() => import('./pages/gestionnaire/DechargesListPage'));
const ReportingPage = React.lazy(() => import('./pages/gestionnaire/ReportingPage'));
const GestionnaireRetoursPage = React.lazy(() => import('./pages/gestionnaire/RetoursPage'));
const GestionnaireAlertesPage = React.lazy(() => import('./pages/gestionnaire/AlertesPage'));
const ChefDechargesPage = React.lazy(() => import('./pages/chef/DechargesPage'));
const DechargeSignPage = React.lazy(() => import('./pages/chef/DechargeSignPage'));
const ChefDemandesPage = React.lazy(() => import('./pages/chef/DemandesPage'));
const DemandeStatusPage = React.lazy(() => import('./pages/chef/DemandeStatusPage'));
const ChefRetoursPage = React.lazy(() => import('./pages/chef/RetoursPage'));
const FinanciereImportExcelPage = React.lazy(() => import('./pages/financiere/ImportExcelPage'));
const FournisseurMarchesPage = React.lazy(() => import('./pages/fournisseur/MarchesPage'));
const FournisseurMarcheTimelinePage = React.lazy(() => import('./pages/fournisseur/MarcheTimelinePage'));
const UtilisateursPage = React.lazy(() => import('./pages/admin/UtilisateursPage'));
const ServicesPage = React.lazy(() => import('./pages/admin/ServicesPage'));
const JournalAuditPage = React.lazy(() => import('./pages/admin/JournalAuditPage'));

const roleRoutes = [
  { path: '/gestionnaire/*', role: 'gestionnaire_magasin' },
  { path: '/financiere/*', role: 'service_financiere' },
  { path: '/chef/*', role: 'chef_service' },
  { path: '/fournisseur/*', role: 'fournisseur' },
  { path: '/admin/*', role: 'admin' },
];

export default function App() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/gestionnaire/dashboard"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/stock"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <StockPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/stock/:id/mouvements"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <MouvementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/marches"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <MarchesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/marches/:id"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <MarcheDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/staging/:import_id/"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <StagingReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/staging/:import_id"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <StagingReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/staging"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <Navigate to="/gestionnaire/marches" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/demandes"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <DemandesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/demandes/:id"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <DemandeDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/decharges/creer/:demande_id"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <DechargeCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/decharges"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <DechargesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/decharges/:id"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <DechargeDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/retours"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <GestionnaireRetoursPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/alertes"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <GestionnaireAlertesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/statistiques"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <ReportingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chef/decharges"
            element={
              <ProtectedRoute requiredRole="chef_service">
                <ChefDechargesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chef/demandes"
            element={
              <ProtectedRoute requiredRole="chef_service">
                <ChefDemandesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chef/demandes/:id"
            element={
              <ProtectedRoute requiredRole="chef_service">
                <DemandeStatusPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chef/decharges/:id/signer"
            element={
              <ProtectedRoute requiredRole="chef_service">
                <DechargeSignPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chef/retours"
            element={
              <ProtectedRoute requiredRole="chef_service">
                <ChefRetoursPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/financiere/marches"
            element={
              <ProtectedRoute requiredRole="service_financiere">
                <MarchesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/financiere/marches/:id"
            element={
              <ProtectedRoute requiredRole="service_financiere">
                <MarcheDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/financiere/import"
            element={
              <ProtectedRoute requiredRole="service_financiere">
                <FinanciereImportExcelPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/fournisseur/marches"
            element={
              <ProtectedRoute requiredRole="fournisseur">
                <FournisseurMarchesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/fournisseur/marches/:id"
            element={
              <ProtectedRoute requiredRole="fournisseur">
                <FournisseurMarcheTimelinePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/utilisateurs"
            element={
              <ProtectedRoute requiredRole="admin">
                <UtilisateursPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/services"
            element={
              <ProtectedRoute requiredRole="admin">
                <ServicesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <ProtectedRoute requiredRole="admin">
                <JournalAuditPage />
              </ProtectedRoute>
            }
          />
          {/* Role-based routes */}
          {roleRoutes.map(({ path, role }) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute requiredRole={role}>
                  <div>{role} area (replace with real routes)</div>
                </ProtectedRoute>
              }
            />
          ))}
          {/* Default route */}
          <Route index element={<Navigate to={isAuthenticated ? '/gestionnaire' : '/login'} />} />
        </Route>
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </React.Suspense>
  );
}
