import { createPublicClient, http, parseUnits } from "viem";
import { linea } from "viem/chains";
import { PoolInformation, getPoolInformationFromLpToken } from "./cartographer";
import { LINEA_CHAIN_ID, CONNEXT_LINEA_ADDRESS } from "./subgraph";
import { LpAccountBalanceHourly, RouterEventResponse } from "./types";

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
    // get lp token balances
    const poolInfo = new Map<string, PoolInformation>();

    // get pool info
    await Promise.all(amms.map(async d => {
        const poolId = d.token.id.toLowerCase();
        if (poolInfo.has(poolId)) {
            return;
        }
        const pool = await getPoolInformationFromLpToken(d.token.id, LINEA_CHAIN_ID);
        poolInfo.set(poolId, pool);
    }));

    // get contract interface
    const client = createPublicClient({ chain: linea, transport: http() });

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
