import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { SynchroLogo } from '@/components/SynchroLogo';

function initials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Header({ hideNavigation = false, guest = false, displayName }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const onHome = location.pathname === '/call';
  const onAdmin = location.pathname.startsWith('/admin');
  const name = displayName || user?.name || '';

  const brand = <SynchroLogo wordClassName="hidden min-[380px]:inline" />;

  return (
    <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-[#E6EBED] bg-white px-4 py-3.5 sm:gap-8 sm:px-10 sm:py-[18px]">
      {guest ? (
        <div className="flex items-center gap-2.5 text-[18px] font-bold tracking-[-0.01em] text-[#0F2A44]">
          {brand}
        </div>
      ) : (
        <Link to="/call" className="flex items-center gap-2.5 text-[18px] font-bold tracking-[-0.01em] text-[#0F2A44]">
          {brand}
        </Link>
      )}

      {!hideNavigation && !guest && (
        <nav className="hidden flex-1 items-center gap-7 md:flex" aria-label="Main">
          <Link
            to="/call"
            aria-current={onHome ? 'page' : undefined}
            className={`border-b-2 py-1.5 text-[15px] font-medium ${
              onHome ? 'border-[#0F2A44] text-[#0F2A44]' : 'border-transparent text-[#6B7A84]'
            }`}
          >
            Home
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              aria-current={onAdmin ? 'page' : undefined}
              className={`border-b-2 py-1.5 text-[15px] font-medium ${
                onAdmin ? 'border-[#0F2A44] text-[#0F2A44]' : 'border-transparent text-[#6B7A84]'
              }`}
            >
              Admin
            </Link>
          )}
        </nav>
      )}

      {!guest && (
        <div className={`flex items-center gap-3 text-sm text-[#6B7A84] sm:gap-4 ${hideNavigation ? 'ml-auto' : 'ml-auto md:ml-0'}`}>
          {!hideNavigation && (
            <Link to="/profile" className="hidden max-w-[140px] truncate font-medium hover:text-[#0F2A44] sm:inline">
              {name || 'User'}
            </Link>
          )}
          {hideNavigation && (
            <span className="hidden max-w-[140px] truncate sm:inline">{name || 'User'}</span>
          )}
          <Link
            to="/profile"
            className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#0F2A44] text-xs font-semibold text-white"
            aria-label="Account"
          >
            {initials(name)}
          </Link>
          <button type="button" onClick={logout} className="border-0 bg-transparent px-1 py-2.5 text-sm text-[#6B7A84] hover:text-[#0F2A44]">
            Log out
          </button>
        </div>
      )}
      {guest && name && (
        <div className="ml-auto flex items-center gap-3 text-sm text-[#6B7A84]">
          <span className="hidden max-w-[140px] truncate sm:inline">{name}</span>
          <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#0F2A44] text-xs font-semibold text-white">
            {initials(name)}
          </span>
        </div>
      )}
    </header>
  );
}
