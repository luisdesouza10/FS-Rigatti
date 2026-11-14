import { ArrowRight, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { AuthLayout } from './AuthLayout';

const linkClass = 'font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300';

/**
 * Confirms only on click: e-mail security scanners often open links on their own,
 * and that must not create the account.
 */
export function ConfirmEmailPage() {
  const { token = '' } = useParams();
  const { confirmEmail } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await confirmEmail(token);
      toast.success('E-mail confirmado! Sua empresa foi criada e você é o administrador.');
      void navigate('/products', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar o e-mail');
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Confirme seu e-mail"
      subtitle={
        <>
          Já tem conta? <Link to="/login" className={linkClass}>Entrar</Link>
        </>
      }
    >
      <div className="space-y-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <MailCheck className="h-6 w-6" />
        </span>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Falta um passo: confirme para criar sua empresa e entrar como administrador.
        </p>

        {error && (
          <div role="alert" className="animate-fade-in space-y-1 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <p>{error}</p>
            <p>
              Se o link venceu, <Link to="/register" className={linkClass}>cadastre de novo</Link> para receber outro.
            </p>
          </div>
        )}

        <Button size="lg" className="w-full" loading={loading} onClick={confirm}>
          Confirmar e entrar <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </AuthLayout>
  );
}
