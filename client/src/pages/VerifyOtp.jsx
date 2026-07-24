import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const RESEND_COOLDOWN_SECONDS = 60;

const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'Enter the 6-digit code')
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export function VerifyOtp() {
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS);
  const location = useLocation();
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const email =
    location.state?.email || sessionStorage.getItem('passwordResetEmail') || '';

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
    shouldUnregister: false,
  });

  const otpValue = watch('otp');

  useEffect(() => {
    if (!email) {
      toast.error('Please enter your email to reset your password');
      navigate('/forgot-password', { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const response = await authAPI.verifyOtp({
        email,
        otp: data.otp,
      });

      const resetToken = response.data.resetToken;
      if (!resetToken) {
        throw new Error('Missing reset token');
      }

      sessionStorage.setItem('passwordResetToken', resetToken);
      sessionStorage.setItem('passwordResetEmail', email);

      toast.success('Code verified successfully');
      navigate('/reset-password', {
        state: { email, resetToken },
        replace: true,
      });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    setResending(true);
    try {
      await authAPI.resendOtp({ email });
      toast.success('A new verification code has been sent');
      setCountdown(RESEND_COOLDOWN_SECONDS);
      setValue('otp', '');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  if (!email) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4 pb-4 border-b">
            <img src="/logo.png" alt="Synchro Logo" className="w-auto h-16 object-contain" />
          </div>
          <CardTitle className="text-3xl">Verify Code</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to{' '}
            <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl tracking-[0.4em] font-semibold"
                value={otpValue || ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setValue('otp', digits, { shouldValidate: true, shouldDirty: true });
                }}
                disabled={loading}
              />
              {errors.otp && (
                <p className="text-sm text-red-500">{errors.otp.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify code'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm space-y-2">
            <p className="text-muted-foreground">Didn&apos;t receive the code?</p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={countdown > 0 || resending}
            >
              {resending
                ? 'Resending...'
                : countdown > 0
                  ? `Resend code in ${countdown}s`
                  : 'Resend code'}
            </Button>
            <div>
              <Link to="/forgot-password" className="text-primary hover:underline">
                Change email
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
