export const iUSDT = '0xEc8DDCb498b44C35EFaD7e5e43E0Caf6D16A66E8'
export const iUSDC = '0x5b45B414c6CD2a3341bE70Ba22BE786b0124003F'
export const stablecoinFarmAddress = "0x29d44c17f4f83b3c77ae2eac4bc1468a496e3196";
export const zeroAddress = "0x0000000000000000000000000000000000000000";

type Address = `0x${string}`;

export const vaultsAddresses: { address: Address, underlying_symbol: string, start_block: bigint, underlying: Address }[] = [
    {
        address: iUSDT, underlying_symbol: "USDC", start_block: 3041467n, underlying: "0xa219439258ca9da29e9cc4ce5596924745e12b93"
    },
    {
        address: iUSDC, underlying_symbol: "USDT", start_block: 3041467n, underlying: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff"
    }
];

export const farmPid: Record<string, number> = {
    [iUSDT]: 0,
    [iUSDC]: 1
}



