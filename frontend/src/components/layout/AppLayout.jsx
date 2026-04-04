import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import NotificationBell from './NotificationBell';

const sidebarConfig = {
  gestionnaire_magasin: [
    { label: 'Dashboard', to: '/gestionnaire/dashboard' },
    { label: 'Stock', to: '/gestionnaire/stock' },
    { label: 'Marchés', to: '/gestionnaire/marches' },
    { label: 'Staging IA', to: '/gestionnaire/staging' },
    { label: 'Demandes', to: '/gestionnaire/demandes' },
    { label: 'Décharges', to: '/gestionnaire/decharges' },
    { label: 'Retours', to: '/gestionnaire/retours' },
    { label: 'Alertes', to: '/gestionnaire/alertes' },
    { label: 'Statistiques', to: '/gestionnaire/statistiques' },
  ],
  service_financiere: [
    { label: 'Marchés', to: '/financiere/marches' },
    { label: 'Import Excel', to: '/financiere/import' },
    { label: 'Alertes', to: '/financiere/alertes' },
  ],
  chef_service: [
    { label: 'Mes Demandes', to: '/chef/demandes' },
    { label: 'Mes Décharges', to: '/chef/decharges' },
    { label: 'Mes Retours', to: '/chef/retours' },
  ],
  fournisseur: [
    { label: 'Mes Marchés', to: '/fournisseur/marches' },
  ],
  admin: [
    { label: 'Utilisateurs', to: '/admin/utilisateurs' },
    { label: 'Services', to: '/admin/services' },
    { label: 'Permissions', to: '/admin/permissions' },
    { label: 'Audit', to: '/admin/audit' },
  ],
};

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const role = user?.id_role?.nom_role || user?.role;
  const sidebarItems = sidebarConfig[role] || [];

  return (
    <div className="app-layout" style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: '#f5f5f5', padding: 16 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 24 }}>FMPDF</div>
        <nav>
          {sidebarItems.map((item) => (
            <div key={item.to} style={{ marginBottom: 12 }}>
              <Link to={item.to}>{item.label}</Link>
            </div>
          ))}
        </nav>
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid #eee' }}>
          <div>
            <span style={{ fontWeight: 'bold' }}>{user?.nom_complet}</span>
            {role && (
              <span style={{ marginLeft: 8, padding: '2px 8px', background: '#eee', borderRadius: 8, fontSize: 12 }}>{role}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <NotificationBell />
            <button onClick={() => { logout(); navigate('/login'); }} style={{ padding: '4px 12px' }}>Logout</button>
          </div>
        </header>
        <div style={{ flex: 1, padding: 24, background: '#fff' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
