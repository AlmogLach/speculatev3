'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';

export default function Header() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const isLandingPage = pathname === '/';

  return (
    <header className="border-b border-gray-200 bg-white backdrop-blur-sm sticky top-0 z-50 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#14B8A6] to-[#0D9488] flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 group-hover:text-[#14B8A6] transition-colors">
              SpeculateX
            </h1>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isActive('/')
                  ? 'text-[#14B8A6] bg-[#14B8A6]/10'
                  : 'text-gray-600 hover:text-[#14B8A6] hover:bg-gray-50'
              }`}
            >
              Home
            </Link>
            <Link
              href="/markets"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isActive('/markets')
                  ? 'text-[#14B8A6] bg-[#14B8A6]/10'
                  : 'text-gray-600 hover:text-[#14B8A6] hover:bg-gray-50'
              }`}
            >
              Markets
            </Link>
            <Link
              href="/admin"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isActive('/admin')
                  ? 'text-[#14B8A6] bg-[#14B8A6]/10'
                  : 'text-gray-600 hover:text-[#14B8A6] hover:bg-gray-50'
              }`}
            >
              Create
            </Link>
            <Link
              href="/claim"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isActive('/claim')
                  ? 'text-[#14B8A6] bg-[#14B8A6]/10'
                  : 'text-gray-600 hover:text-[#14B8A6] hover:bg-gray-50'
              }`}
            >
              Claim
            </Link>
          </nav>

          {/* Right Side - Wallet or Launch App */}
          <div className="flex items-center gap-3">
            {isLandingPage ? (
              // Show "Launch App" button on landing page
              <Link
                href="/markets"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#14B8A6] to-[#0D9488] px-6 py-2.5 text-sm font-bold text-white hover:shadow-lg transition-all transform hover:scale-105"
              >
                Launch App
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            ) : (
              // Show wallet connect on dapp pages with custom styling
              <div className="wallet-connect-wrapper">
                <ConnectButton.Custom>
                  {({
                    account,
                    chain,
                    openAccountModal,
                    openChainModal,
                    openConnectModal,
                    authenticationStatus,
                    mounted,
                  }) => {
                    const ready = mounted && authenticationStatus !== 'loading';
                    const connected =
                      ready &&
                      account &&
                      chain &&
                      (!authenticationStatus ||
                        authenticationStatus === 'authenticated');

                    return (
                      <div
                        {...(!ready && {
                          'aria-hidden': true,
                          style: {
                            opacity: 0,
                            pointerEvents: 'none',
                            userSelect: 'none',
                          },
                        })}
                      >
                        {(() => {
                          if (!connected) {
                            return (
                              <button
                                onClick={openConnectModal}
                                type="button"
                                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#14B8A6] to-[#0D9488] px-6 py-2.5 text-sm font-bold text-white hover:shadow-lg transition-all transform hover:scale-105 shadow-md"
                              >
                                Connect Wallet
                              </button>
                            );
                          }

                          if (chain.unsupported) {
                            return (
                              <button
                                onClick={openChainModal}
                                type="button"
                                className="inline-flex items-center justify-center rounded-full bg-red-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-all shadow-md"
                              >
                                Wrong Network
                              </button>
                            );
                          }

                          return (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={openChainModal}
                                type="button"
                                className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 hover:bg-gray-200 transition-all"
                              >
                                {chain.hasIcon && (
                                  <div
                                    style={{
                                      background: chain.iconBackground,
                                      width: 20,
                                      height: 20,
                                      borderRadius: 999,
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {chain.iconUrl && (
                                      <img
                                        alt={chain.name ?? 'Chain icon'}
                                        src={chain.iconUrl}
                                        style={{ width: 20, height: 20 }}
                                      />
                                    )}
                                  </div>
                                )}
                                <span className="text-sm font-semibold text-gray-700">
                                  {chain.name}
                                </span>
                              </button>

                              <button
                                onClick={openAccountModal}
                                type="button"
                                className="flex items-center gap-2 rounded-full bg-white border-2 border-gray-200 px-4 py-2 hover:border-[#14B8A6] transition-all shadow-sm hover:shadow-md"
                              >
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="text-sm font-bold text-gray-900">
                                  {account.displayBalance
                                    ? ` ${account.displayBalance}`
                                    : ''}
                                </span>
                                <span className="text-sm font-semibold text-gray-600">
                                  {account.displayName}
                                </span>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}