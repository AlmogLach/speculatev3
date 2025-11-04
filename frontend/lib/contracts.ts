export const addresses = {
  core: (process.env.NEXT_PUBLIC_CORE_ADDRESS || '0x62B7446a9F5aB766b82592e6B997178e0F0dA0e7') as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0xBb5102A950B51ab8079549b2a0FE78910FE55b5C') as `0x${string}`,
  admin: (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || '0xbd0e87A678f3D53a27D1bb186cfc8fd465433554') as `0x${string}`,
};

export const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '97');

