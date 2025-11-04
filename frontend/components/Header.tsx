'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <header className="border-b border-gray-200 bg-[#FAF9FF] shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#14B8A6] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                SpeculateX
              </h1>
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className={`text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'text-[#14B8A6]'
                  : 'text-gray-700 hover:text-[#14B8A6]'
              }`}
            >
              Home
            </Link>
            <Link
              href="/markets"
              className={`text-sm font-medium transition-colors ${
                isActive('/markets')
                  ? 'text-[#14B8A6]'
                  : 'text-gray-700 hover:text-[#14B8A6]'
              }`}
            >
              Markets
            </Link>
            <Link
              href="/create"
              className={`text-sm font-medium transition-colors ${
                isActive('/create')
                  ? 'text-[#14B8A6]'
                  : 'text-gray-700 hover:text-[#14B8A6]'
              }`}
            >
              Create
            </Link>
            <Link
              href="/claim"
              className={`text-sm font-medium transition-colors ${
                isActive('/claim')
                  ? 'text-[#14B8A6]'
                  : 'text-gray-700 hover:text-[#14B8A6]'
              }`}
            >
              Claim
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
