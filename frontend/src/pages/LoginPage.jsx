import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../store/authStore';

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email requis.' })
    .min(1, 'Email requis.')
    .email('Adresse email invalide.'),
  password: z.string({ required_error: 'Mot de passe requis.' }).min(1, 'Mot de passe requis.'),
});

const roleRedirectMap = {
  gestionnaire_magasin: '/gestionnaire/dashboard',
  service_financiere: '/financiere/marches',
  chef_service: '/chef/demandes',
  fournisseur: '/fournisseur/marches',
  admin: '/admin/utilisateurs',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const cardStyle = useMemo(
    () => ({
      width: '100%',
      maxWidth: 420,
      background: '#ffffff',
      borderRadius: 14,
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      padding: 28,
    }),
    []
  );

  const onSubmit = async (values) => {
    setAuthError('');
    try {
      await login(values.email, values.password);
      const user = useAuthStore.getState().user;
      const role = user?.id_role?.nom_role || user?.role;
      navigate(roleRedirectMap[role] || '/login', { replace: true });
    } catch (error) {
      if (error?.response?.status === 401) {
        setAuthError('Identifiants invalides. Veuillez réessayer.');
        return;
      }
      setAuthError('Une erreur est survenue. Veuillez réessayer plus tard.');
    }
  };

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
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div
            style={{
              width: 54,
              height: 54,
              margin: '0 auto 12px',
              borderRadius: '50%',
              background: '#111827',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
            }}
          >
            FM
          </div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#111827' }}>FMPDF</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>
            Faculté de Médecine et de Pharmacie de Dakar
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="email" style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#111827' }}>
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              placeholder="nom@universite.sn"
              {...register('email')}
              style={{
                width: '100%',
                border: `1px solid ${errors.email ? '#ef4444' : '#d1d5db'}`,
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 14,
                outline: 'none',
              }}
            />
            {errors.email && (
              <p style={{ margin: '6px 0 0', color: '#dc2626', fontSize: 12 }}>{errors.email.message}</p>
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <label htmlFor="password" style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#111827' }}>
              Mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                style={{
                  width: '100%',
                  border: `1px solid ${errors.password ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: 10,
                  padding: '10px 40px 10px 12px',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: 2,
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p style={{ margin: '6px 0 0', color: '#dc2626', fontSize: 12 }}>{errors.password.message}</p>
            )}
          </div>

          {authError && (
            <div
              style={{
                marginBottom: 12,
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 13,
              }}
            >
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              border: 'none',
              background: '#111827',
              color: '#fff',
              borderRadius: 10,
              padding: '11px 12px',
              fontSize: 14,
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Connexion en cours…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
