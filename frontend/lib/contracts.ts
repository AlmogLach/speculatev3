export const addresses = {
  core: (process.env.NEXT_PUBLIC_CORE_ADDRESS || '0xD891d6Ae53670e28574fC33333C981ACB1e3a40b') as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x94C1e25E6eD7B24674fe77f13fF24a57542CCCDB') as `0x${string}`,
  admin: (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || '0xbd0e87A678f3D53a27D1bb186cfc8fd465433554') as `0x${string}`,
};

export const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '97');

