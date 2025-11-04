import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, bscTestnet } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'SpeculateX v3',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'speculatex-v3',
  chains: [bscTestnet],
  ssr: true,
});


