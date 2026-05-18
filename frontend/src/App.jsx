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
const MarcheManualCreatePage = React.lazy(() => import('./pages/shared/MarcheManualCreatePage'));
const StagingReviewPage = React.lazy(() => import('./pages/gestionnaire/StagingReviewPage'));
const DonneesExtraitesPage = React.lazy(() => import('./pages/gestionnaire/DonneesExtraitesPage'));
const DonneesExtraitesDetailPage = React.lazy(() => import('./pages/gestionnaire/DonneesExtraitesDetailPage'));
const DemandesListPage = React.lazy(() => import('./pages/gestionnaire/DemandesListPage'));
const DemandeDetailPage = React.lazy(() => import('./pages/gestionnaire/DemandeDetailPage'));
const DechargeCreatePage = React.lazy(() => import('./pages/gestionnaire/DechargeCreatePage'));
const DechargeDetailPage = React.lazy(() => import('./pages/gestionnaire/DechargeDetailPage'));
const DechargesListPage = React.lazy(() => import('./pages/gestionnaire/DechargesListPage'));
const ReportingPage = React.lazy(() => import('./pages/gestionnaire/ReportingPage'));
const GestionnaireRetoursPage = React.lazy(() => import('./pages/gestionnaire/RetoursPage'));
const GestionnaireAlertesPage = React.lazy(() => import('./pages/gestionnaire/AlertesPage'));
const NotificationsPage = React.lazy(() => import('./pages/gestionnaire/NotificationsPage'));
const ChefDechargesPage = React.lazy(() => import('./pages/chef/DechargesPage'));
const ChefDechargeDetailPage = React.lazy(() => import('./pages/chef/ChefDechargeDetailPage'));
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
                <MarchesListPage fixedType="marche" />
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
          <Route path="/gestionnaire/bons-commande/:id" element={<ProtectedRoute requiredRole="gestionnaire_magasin"><MarcheDetailPage /></ProtectedRoute>} />
          <Route path="/gestionnaire/dons/:id" element={<ProtectedRoute requiredRole="gestionnaire_magasin"><MarcheDetailPage /></ProtectedRoute>} />
          <Route
            path="/gestionnaire/marches/nouveau"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <MarcheManualCreatePage />
              </ProtectedRoute>
            }
          />
          <Route path="/gestionnaire/bons-commande/nouveau" element={<ProtectedRoute requiredRole="gestionnaire_magasin"><MarcheManualCreatePage /></ProtectedRoute>} />
          <Route path="/gestionnaire/dons/nouveau" element={<ProtectedRoute requiredRole="gestionnaire_magasin"><MarcheManualCreatePage /></ProtectedRoute>} />
          <Route
            path="/gestionnaire/bons-commande"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <MarchesListPage fixedType="bon_commande" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/dons"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <MarchesListPage fixedType="donation" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestionnaire/import"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <FinanciereImportExcelPage />
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
                <Navigate to="/gestionnaire/donnees-extraites" replace />
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
            path="/gestionnaire/notifications"
            element={
              <ProtectedRoute requiredRole="gestionnaire_magasin">
                <NotificationsPage />
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
            path="/chef/decharges/:id"
            element={
              <ProtectedRoute requiredRole="chef_service">
                <ChefDechargeDetailPage />
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
                <MarchesListPage fixedType="marche" />
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
          <Route path="/financiere/bons-commande/:id" element={<ProtectedRoute requiredRole="service_financiere"><MarcheDetailPage /></ProtectedRoute>} />
          <Route path="/financiere/dons/:id" element={<ProtectedRoute requiredRole="service_financiere"><MarcheDetailPage /></ProtectedRoute>} />
          <Route
            path="/financiere/marches/nouveau"
            element={
              <ProtectedRoute requiredRole="service_financiere">
                <MarcheManualCreatePage />
              </ProtectedRoute>
            }
          />
          <Route path="/financiere/bons-commande/nouveau" element={<ProtectedRoute requiredRole="service_financiere"><MarcheManualCreatePage /></ProtectedRoute>} />
          <Route path="/financiere/dons/nouveau" element={<ProtectedRoute requiredRole="service_financiere"><MarcheManualCreatePage /></ProtectedRoute>} />
          <Route
            path="/financiere/bons-commande"
            element={
              <ProtectedRoute requiredRole="service_financiere">
                <MarchesListPage fixedType="bon_commande" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/financiere/dons"
            element={
              <ProtectedRoute requiredRole="service_financiere">
                <MarchesListPage fixedType="donation" />
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
            path="/financiere/alertes"
            element={
              <ProtectedRoute requiredRole="service_financiere">
                <GestionnaireAlertesPage />
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
          {/* Default route — redirect each role to their home page */}
          <Route
            index
            element={(() => {
              if (!isAuthenticated) return <Navigate to="/login" />;
              const role = user?.id_role?.nom_role ?? user?.role;
              if (role === 'chef_service')        return <Navigate to="/chef/demandes" replace />;
              if (role === 'service_financiere')  return <Navigate to="/financiere/marches" replace />;
              if (role === 'fournisseur')          return <Navigate to="/fournisseur/marches" replace />;
              if (role === 'admin')                return <Navigate to="/admin/utilisateurs" replace />;
              return <Navigate to="/gestionnaire/dashboard" replace />;
            })()}
          />
        </Route>
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </React.Suspense>
  );
}
