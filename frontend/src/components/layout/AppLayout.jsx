import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  ClipboardList,
  Gift,
  Upload,
  Database,
  FileText,
  PackageCheck,
  RotateCcw,
  BarChart2,
  Settings,
  Users,
  Tag,
  LogOut,
  Bell,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import NotificationBell from './NotificationBell';

const sidebarConfig = {
  gestionnaire_magasin: [
    { label: 'Dashboard', path: '/gestionnaire/dashboard', icon: LayoutDashboard },
    { label: 'Stock', path: '/gestionnaire/stock', icon: Package },
    { label: 'Marchés', path: '/gestionnaire/marches', icon: ShoppingBag },
    { label: 'Bons de Commande', path: '/gestionnaire/bons-commande', icon: ClipboardList },
    { label: 'Dons', path: '/gestionnaire/dons', icon: Gift },
    { label: 'Import Excel', path: '/gestionnaire/import', icon: Upload },
    { label: 'Demandes', path: '/gestionnaire/demandes', icon: FileText },
    { label: 'Décharges', path: '/gestionnaire/decharges', icon: PackageCheck },
    { label: 'Retours', path: '/gestionnaire/retours', icon: RotateCcw },
    { label: 'Alertes', path: '/gestionnaire/alertes', icon: Bell },
    { label: 'Statistiques', path: '/gestionnaire/statistiques', icon: BarChart2 },
  ],
  service_financiere: [
    { label: 'Marchés', path: '/financiere/marches', icon: ShoppingBag },
    { label: 'Bons de Commande', path: '/financiere/bons-commande', icon: ClipboardList },
    { label: 'Dons', path: '/financiere/dons', icon: Gift },
    { label: 'Import Excel', path: '/financiere/import', icon: Upload },
    { label: 'Alertes', path: '/financiere/alertes', icon: Bell },
  ],
  chef_service: [
    { label: 'Demandes', path: '/chef/demandes', icon: FileText },
    { label: 'Décharges', path: '/chef/decharges', icon: PackageCheck },
    { label: 'Retours', path: '/chef/retours', icon: RotateCcw },
  ],
  fournisseur: [
    { label: 'Marchés', path: '/fournisseur/marches', icon: ShoppingBag },
  ],
  admin: [
    { label: 'Utilisateurs', path: '/admin/utilisateurs', icon: Users },
    { label: 'Services', path: '/admin/services', icon: Settings },
    { label: 'Catégories', path: '/admin/categories', icon: Tag },
    { label: 'Journal', path: '/admin/audit', icon: Database },
  ],
};

const PAGE_TITLES = {
  '/gestionnaire/dashboard': 'Dashboard',
  '/gestionnaire/stock': 'Inventaire',
  '/gestionnaire/marches': 'Marchés',
  '/gestionnaire/bons-commande': 'Bons de Commande',
  '/gestionnaire/dons': 'Dons',
  '/gestionnaire/import': 'Import Excel',
  '/gestionnaire/demandes': 'Demandes',
  '/gestionnaire/decharges': 'Décharges',
  '/gestionnaire/retours': 'Retours',
  '/gestionnaire/alertes': 'Alertes',
  '/gestionnaire/statistiques': 'Statistiques',
  '/financiere/marches': 'Marchés',
  '/financiere/bons-commande': 'Bons de Commande',
  '/financiere/dons': 'Dons',
  '/financiere/import': 'Import Excel',
  '/financiere/alertes': 'Alertes',
  '/chef/demandes': 'Demandes',
  '/chef/decharges': 'Décharges',
  '/chef/retours': 'Retours',
  '/admin/utilisateurs': 'Utilisateurs',
  '/admin/services': 'Services',
  '/admin/categories': 'Catégories',
  '/admin/journal': 'Journal',
};

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const role = pick(user?.id_role?.nom_role, user?.idRole?.nomRole, user?.role);
  const sidebarItems = sidebarConfig[role] || [];
  const currentTitle = Object.entries(PAGE_TITLES)
    .filter(([path]) => location.pathname.startsWith(path))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] || '';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-white text-ink">
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#1e2a3a',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            padding: '24px 20px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                F
              </span>
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'white',
                  lineHeight: 1.2,
                }}
              >
                FMPDF
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Gestion des stocks</div>
            </div>
          </div>
        </div>

        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {sidebarItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: isActive ? '#6ee7b7' : 'rgba(255,255,255,0.5)',
                }}
                onMouseEnter={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                    event.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                  }
                }}
                onMouseLeave={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.background = 'transparent';
                    event.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                  }
                }}
              >
                <Icon size={15} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, fontFamily: "'DM Sans', sans-serif" }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 4 }}>Connecté en tant que</div>
          <div
            style={{
              display: 'inline-block',
              background: 'rgba(59,130,246,0.15)',
              color: '#93c5fd',
              fontSize: 11,
              fontWeight: 500,
              padding: '3px 10px',
              borderRadius: 20,
              border: '1px solid rgba(59,130,246,0.25)',
            }}
          >
            {pick(user?.role, role, 'Gestionnaire')}
          </div>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, padding: '30px 32px 32px' }}>
          {!location.pathname.endsWith('/dashboard') && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h1
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#0C447C',
                  margin: 0,
                }}
              >
                {currentTitle}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <NotificationBell />
                <button
                  onClick={handleLogout}
                  type="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    color: 'rgba(0,0,0,0.5)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = 'transparent';
                  }}
                  title="Déconnexion"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
