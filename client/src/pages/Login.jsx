import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { LuEye, LuEyeOff } from 'react-icons/lu';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export function Login() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, isAuthenticated, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (user?.status === 'pending') {
        navigate('/pending-approval', { replace: true });
      } else if (user?.status === 'rejected') {
        navigate('/rejected', { replace: true });
      } else if (user?.status === 'suspended') {
        navigate('/suspended', { replace: true });
      } else {
        // Preserve any query params from location state
        const from = location.state?.from;
        if (from) {
          navigate(`${from.pathname}${from.search || ''}`, { replace: true });
        } else {
          navigate('/call', { replace: true });
        }
      }
    }
  }, [isAuthenticated, authLoading, user, navigate, location.state]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const result = await login(data.email, data.password);

      if (result.success) {
        toast.success('Login successful!');
        // Redirect to intended page with preserved search params (e.g., ?roomid=xxx)
        const from = location.state?.from;
        if (from) {
          // Preserve both pathname and search params
          navigate(`${from.pathname}${from.search || ''}`, { replace: true });
        } else {
          navigate('/call', { replace: true });
        }
      } else {
        if (result.status === 'pending') {
          navigate('/pending-approval');
        } else if (result.status === 'rejected') {
          navigate('/rejected');
        } else if (result.status === 'suspended') {
          navigate('/suspended');
        } else {
          toast.error(result.error || 'Login failed');
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4 pb-4 border-b">
            <img src="/logo.png" alt="Synchro Logo" className="w-auto h-16 object-contain" />
          </div>
          <CardTitle className="text-3xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(e); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
                disabled={loading}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password')}
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showPassword ? (
                    <LuEyeOff className="w-4 h-4" />
                  ) : (
                    <LuEye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link to="/register" className="text-primary hover:underline">
              Register
            </Link>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
