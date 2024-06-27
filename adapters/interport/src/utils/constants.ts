export const iUSDT = '0xEc8DDCb498b44C35EFaD7e5e43E0Caf6D16A66E8'
export const iUSDC = '0x5b45B414c6CD2a3341bE70Ba22BE786b0124003F'
export const stablecoinFarmAddress = "0x29d44c17f4f83b3c77ae2eac4bc1468a496e3196";
export const zeroAddress = "0x0000000000000000000000000000000000000000";

export const vaultsAddresses: { address: `0x${string}`, token_symbol: string, start_block: bigint }[] = [
    {
        address: iUSDT, token_symbol: "iUSDC", start_block: 3041467n
    },
    {
        address: iUSDC, token_symbol: "iUSDT", start_block: 3041467n
    }
];

export const farmPid: Record<string, number> = {
    [iUSDT]: 0,
    [iUSDC]: 1
}



