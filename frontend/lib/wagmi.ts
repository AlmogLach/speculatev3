import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { bscTestnet } from 'wagmi/chains';
import { http } from 'wagmi';
import { quickNodeRpcUrl } from './contracts';

export const config = getDefaultConfig({
  appName: 'SpeculateX v3',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'speculatex-v3',
  chains: [bscTestnet],
  ssr: true,
  transports: {
    [bscTestnet.id]: http(quickNodeRpcUrl),
  },
});
