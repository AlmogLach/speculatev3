import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { bscTestnet } from 'wagmi/chains';
import { http } from 'wagmi';

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';

export const config = getDefaultConfig({
  appName: 'SpeculateX v3',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'speculatex-v3',
  chains: [bscTestnet],
  ssr: true,
  transports: {
    [bscTestnet.id]: http(rpcUrl),
  },
});
