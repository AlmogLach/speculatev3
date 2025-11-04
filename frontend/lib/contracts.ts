export const addresses = {
  core: (process.env.NEXT_PUBLIC_CORE_ADDRESS || '0x83438B43dAFfe80e67Ca7204eaEe4674d0EF6BBe') as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x0E5cB1F812ce0402fdF0c9cee2E1FE3BF351a827') as `0x${string}`,
  admin: (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || '0xbd0e87A678f3D53a27D1bb186cfc8fd465433554') as `0x${string}`,
};

export const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '97');

