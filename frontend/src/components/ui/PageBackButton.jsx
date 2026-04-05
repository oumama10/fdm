import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from './button';

export default function PageBackButton({ to, onClick, label = 'Retour', hint = '', className }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (typeof onClick === 'function') {
      onClick();
      return;
    }

    if (to === 'back') {
      navigate(-1);
      return;
    }

    if (to) {
      navigate(to);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={handleClick}
      style={{
        justifyContent: 'center',
        width: 40,
        padding: 0,
        borderRadius: 999,
        background: '#f8fafc',
        borderColor: '#e2e8f0',
        color: '#0f172a',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
        flexShrink: 0,
      }}
      aria-label={label}
      title={label}
    >
      <ChevronLeft size={18} strokeWidth={2.5} />
    </Button>
  );
}