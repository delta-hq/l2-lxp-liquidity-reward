import { parseUnits } from "viem";
import { getPoolInformationFromLpToken, poolInfo } from "./cartographer";
import { LINEA_CHAIN_ID, CONNEXT_LINEA_ADDRESS } from "./subgraph";
import { LpAccountBalanceHourly } from "./types";
import { getClient } from "./rpc";

type CompositeBalanceHourly = LpAccountBalanceHourly & {
    underlyingTokens: string[];
    underlyingBalances: string[];
}

const CONNEXT_ABI = [
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "key",
                "type": "bytes32"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "calculateRemoveSwapLiquidity",
        "outputs": [
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

export const getCompositeBalances = async (amms: LpAccountBalanceHourly[]): Promise<CompositeBalanceHourly[]> => {
    // get pool info
    for (const amm of amms) {
        await getPoolInformationFromLpToken(amm.token.id, LINEA_CHAIN_ID)
    }

    // get contract interface
    const client = getClient();

    // get composite balances for amms (underlying tokens and balances)
    const balances = await Promise.all(amms.map(async ({ token, amount, block }) => {
        const poolId = token.id.toLowerCase();
        const pool = poolInfo.get(poolId);
        if (!pool) {
            throw new Error(`Pool info not found for token: ${token.id}`);
        }
        // calculate the swap if you remove equal
        const withdrawn = await client.readContract({
            address: CONNEXT_LINEA_ADDRESS,
            functionName: "calculateRemoveSwapLiquidity",
            args: [pool.key, parseUnits(amount, 18)],
            abi: CONNEXT_ABI,
            blockNumber: BigInt(block)
        }) as [bigint, bigint];
        return withdrawn.map(w => w.toString());
    }));

    // return composite balance object
    const ret = amms.map((d, idx) => {
        const { pooledTokens } = poolInfo.get(d.token.id.toLowerCase())!;
        return {
            ...d,
            underlyingTokens: pooledTokens,
            underlyingBalances: balances[idx] as [string, string]
        }
    })
    return ret;
}
