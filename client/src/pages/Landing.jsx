import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <img src="/logo.png" alt="Synchro Logo" className="w-16 h-16 object-contain" />
            <div className="text-left">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Synchro
              </h1>
              <p className="text-lg text-muted-foreground mt-1">Seamless Connections</p>
            </div>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            High-quality video calls powered by WebRTC. Connect with anyone, anywhere, anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>🎥 HD Video</CardTitle>
              <CardDescription>Crystal clear video quality</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Experience high-definition video calls with low latency and excellent quality.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔒 Secure</CardTitle>
              <CardDescription>End-to-end encrypted</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your conversations are secure with industry-standard encryption.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>⚡ Fast</CardTitle>
              <CardDescription>Low latency connections</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Connect instantly with minimal delay for natural conversations.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center space-x-4">
          <Link to="/register">
            <Button size="lg" className="text-lg px-8">
              Get Started
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" className="text-lg px-8">
              Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
