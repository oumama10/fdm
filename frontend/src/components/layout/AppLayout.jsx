import React from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  FileSpreadsheet,
  Gift,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  ShoppingCart,
  Tag,
  Undo2,
  Warehouse,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import NotificationBell from './NotificationBell';
import { cn } from '@/lib/utils';

const sidebarConfig = {
  gestionnaire_magasin: [
    { label: 'Dashboard', to: '/gestionnaire/dashboard' },
    { label: 'Inventaire', to: '/gestionnaire/stock' },
    { label: 'Importation', to: '/gestionnaire/import' },
    { label: 'Marchés', to: '/gestionnaire/marches' },
    { label: 'Bon de commandes', to: '/gestionnaire/bon-commandes' },
    { label: 'Dons', to: '/gestionnaire/dons' },
    { label: 'Données Extraites', to: '/gestionnaire/donnees-extraites' },
    { label: 'Demandes', to: '/gestionnaire/demandes' },
    { label: 'Décharges', to: '/gestionnaire/decharges' },
    { label: 'Retours', to: '/gestionnaire/retours' },
    { label: 'Statistiques', to: '/gestionnaire/statistiques' },
    { label: 'Catégories', to: '/gestionnaire/categories' },
    { label: 'Alertes', to: '/gestionnaire/alertes' },
  ],
  service_financiere: [
    { label: 'Importation', to: '/financiere/import' },
    { label: 'Marchés', to: '/financiere/marches' },
    { label: 'Bon de commandes', to: '/financiere/bon-commandes' },
    { label: 'Dons', to: '/financiere/dons' },
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
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.id_role?.nom_role || user?.role;
  const sidebarItems = sidebarConfig[role] || [];

  const iconByLabel = {
    Dashboard: LayoutDashboard,
    Inventaire: Warehouse,
    Importation: FileSpreadsheet,
    'Import Excel': FileSpreadsheet,
    'Marchés': ShoppingCart,
    'Bon de commandes': ClipboardCheck,
    Dons: Gift,
    'Données Extraites': Package,
    Demandes: Receipt,
    'Décharges': Package,
    Retours: Undo2,
    Statistiques: BarChart3,
    'Catégories': Tag,
    Alertes: AlertTriangle,
  };

  const currentLabel = React.useMemo(() => {
    const matched = sidebarItems.find((item) => location.pathname.startsWith(item.to));
    return matched?.label || 'Tableau de bord';
  }, [location.pathname, sidebarItems]);

  const roleLabel = role?.replaceAll('_', ' ') || 'utilisateur';

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <aside className={cn('sidebar', mobileOpen && 'open')}>
        <div className="sidebar-brand">
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 600, fontSize: 22, lineHeight: 1 }}>FMPDF</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Gestion des ressources</div>
        </div>
        <nav className="sidebar-nav">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn('nav-link', isActive && 'active')}
            >
              {React.createElement(iconByLabel[item.label] || Package, { size: 16 })}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-role">
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4 }}>
            Connecté en tant que
          </span>
          <span className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
            {roleLabel}
          </span>
        </div>
      </aside>
      <main className="main-wrap">
        <header className="topbar" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn btn-secondary"
              style={{ padding: 6 }}
              onClick={() => setMobileOpen((s) => !s)}
              aria-label="Basculer le menu"
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15 }}>{currentLabel}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <NotificationBell />
            <button
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              onClick={() => { logout(); navigate('/login'); }}
            >
              <LogOut size={15} />
              Déconnexion
            </button>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
