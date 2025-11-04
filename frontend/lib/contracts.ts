export const addresses = {
  core: (process.env.NEXT_PUBLIC_CORE_ADDRESS || '0x02344e92a5389D3cB0100844eE262CA10818aC6e') as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x4B40348623C230F666780aa626a70cf5C95D908a') as `0x${string}`,
  admin: (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || '0xbd0e87A678f3D53a27D1bb186cfc8fd465433554') as `0x${string}`,
};

export const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '97');

