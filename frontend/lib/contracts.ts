export const addresses = {
  core: (process.env.NEXT_PUBLIC_CORE_ADDRESS || '0x3a9F3AE06f2D23F76B1882BB5864B64c107FC37E') as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0xf623e17a1e6aBd8F9C032243385703483586ACeE') as `0x${string}`,
  admin: (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || '0xbd0e87A678f3D53a27D1bb186cfc8fd465433554') as `0x${string}`,
};

export const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '97');

