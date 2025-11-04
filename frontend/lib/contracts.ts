export const addresses = {
  core: (process.env.NEXT_PUBLIC_CORE_ADDRESS || '0xFc648ebeb2118be2598eb6fc008D4c94b7Ba0Ba3') as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0xF0D8e40068AA5368581Cc6B251E6C2a4aa51E7a3') as `0x${string}`,
  admin: (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || '0xbd0e87A678f3D53a27D1bb186cfc8fd465433554') as `0x${string}`,
};

export const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '97');

