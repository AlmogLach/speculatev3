'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="text-2xl">📊</div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                SpeculateX
              </h1>
              <span className="text-xs text-gray-500 font-normal">v3</span>
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/markets"
              className={`text-sm font-medium transition-colors ${
                isActive('/markets')
                  ? 'text-green-600 border-b-2 border-green-600 pb-1'
                  : 'text-gray-700 hover:text-green-600'
              }`}
            >
              Markets
            </Link>
            <Link
              href="/portfolio"
              className={`text-sm font-medium transition-colors ${
                isActive('/portfolio')
                  ? 'text-green-600 border-b-2 border-green-600 pb-1'
                  : 'text-gray-700 hover:text-green-600'
              }`}
            >
              Portfolio
            </Link>
            <Link
              href="/admin"
              className={`text-sm font-medium transition-colors ${
                isActive('/admin')
                  ? 'text-green-600 border-b-2 border-green-600 pb-1'
                  : 'text-gray-700 hover:text-green-600'
              }`}
            >
              Admin
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}
