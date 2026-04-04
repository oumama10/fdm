import { Link } from 'react-router-dom';

export default function ForbiddenPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          padding: 24,
          maxWidth: 460,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1 style={{ marginTop: 0 }}>403 — Accès refusé</h1>
        <p>Vous n’avez pas les permissions nécessaires pour accéder à cette page.</p>
        <Link to="/login">Retour à la connexion</Link>
      </div>
    </div>
  );
}
