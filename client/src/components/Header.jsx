import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { LuLogOut, LuUser } from 'react-icons/lu';
import { cn } from '@/lib/utils';

export function Header({ hideNavigation = false }) {
    const { user, logout, isAdmin } = useAuth();
    const location = useLocation();

    const isActive = (path) => {
        if (path === '/call') {
            return location.pathname === '/call';
        }
        if (path === '/admin') {
            return location.pathname.startsWith('/admin');
        }
        return false;
    };

    return (
        <header className="border-b bg-background sticky top-0 z-40">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/call" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <img src="/logo.png" alt="Synchro Logo" className="w-auto h-[54px] object-contain" />
                    </Link>

                    {/* Navigation Tabs - Hidden during active call */}
                    {!hideNavigation && (
                        <div className="flex items-center gap-1">
                            {isAdmin &&
                                <Link to="/call">
                                    <Button
                                        variant={'ghost'}
                                        size="sm"
                                        className={cn(
                                            'h-9 px-4',
                                            isActive('/call') && 'text-primary font-semibold'
                                        )}
                                    >
                                        Home
                                    </Button>
                                </Link>}
                            {isAdmin && (
                                <Link to="/admin">
                                    <Button
                                        variant={'ghost'}
                                        size="sm"
                                        className={cn(
                                            'h-9 px-4',
                                            isActive('/admin') && 'text-primary font-semibold'
                                        )}
                                    >
                                        Admin
                                    </Button>
                                </Link>
                            )}
                        </div>
                    )}

                    {/* Right side - User info and Logout */}
                    <div className="flex items-center gap-4">
                        {/* Profile link - Hidden during active call */}
                        {!hideNavigation && (
                            <Link to="/profile" className="hover:bg-accent hover:text-accent-foreground rounded-md p-2 hover:text-gray-700 hover:font-medium transition-all duration-300 text-muted-foreground cursor-pointer">
                                <div className="flex items-center gap-2 text-sm">
                                    <LuUser className="w-4 h-4" />
                                    <span>{user?.name || 'User'}</span>
                                </div>
                            </Link>
                        )}
                        {/* User name without link - Shown during active call */}
                        {hideNavigation && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LuUser className="w-4 h-4" />
                                <span>{user?.name || 'User'}</span>
                            </div>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={logout}
                            className="flex items-center gap-2"
                        >
                            <LuLogOut className="w-4 h-4" />
                            Logout
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}
