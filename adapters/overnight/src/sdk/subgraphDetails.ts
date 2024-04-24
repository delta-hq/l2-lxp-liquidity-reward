import BN from "bignumber.js";
import { LINEA_RPC, CHAINS, OVN_CONTRACTS, PROTOCOLS, RPC_URLS, SUBGRAPH_URLS, USD_PLUS_LINEA, ZERO_ADD, CHUNKS_SPLIT, USDT_PLUS_LINEA } from "./config";
import { Address, createPublicClient, extractChain, http } from "viem";
import { linea } from "viem/chains";
import { ethers } from "ethers";
import { ERC20_ABI } from "./abi";

export interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

export interface BlockDataRebase {
    blockNumberFrom: number;
    blockNumberTo: number;
    token: OVN_CONTRACTS.USDPLUS | OVN_CONTRACTS.USDTPLUS;
}

export interface Position{
    id: string;
    liquidity: bigint;
    owner: string;
    address: string;
};

export interface PositionRebase{
    id: string;
    value: bigint;
    from: string;
    to: string;
};

export interface PositionRebaseNet{
    id: string;
    address: string;
    value: bigint;
};

export interface PositionWithUSDValue extends Position{
    token0USDValue: string;
    token1USDValue: string;
    token0AmountsInWei: bigint;
    token1AmountsInWei: bigint;
    token0DecimalValue: number;
    token1DecimalValue: number;
}

const countNetRebase = async (
    usersMinted: Map<string, string>,
    usersRedeemed: Map<string, string>,
    blockNumberFrom: number,
    blockNumberTo: number,
    tokenContract: string
) => {
    const PRIVATE = "0x1bbac7f04cf9a4ce3a011c139af70fafe8921cf4a66d49c6634a04ef2118d0b7";

    const provider = new ethers.providers.StaticJsonRpcProvider(LINEA_RPC);
    // Connect to wallet to sign transactions
    const wallet = new ethers.Wallet(PRIVATE, provider);

    const etherC = new ethers.Contract(tokenContract, ERC20_ABI, wallet) as any;
    const usersRebaseProfit: Map<string, string> = new Map();

    // top holders (pools, contracts)
    const exclude = [
        // usd+
        "0x58aacbccaec30938cb2bb11653cad726e5c4194a",
        "0xc5f4c5c2077bbbac5a8381cf30ecdf18fde42a91",
        "0x3f006b0493ff32b33be2809367f5f6722cb84a7b",
        "0x65d97bdfd4c1076cd1f95cbe3b56954277d0956f",
        // usdt+
        "0xb30e7a2e6f7389ca5ddc714da4c991b7a1dcc88e",
        "0xc5f4c5c2077bbbac5a8381cf30ecdf18fde42a91"
    ]

    let index = 0;
    console.log('Counting net rebases for users...');
    for (const [key, val] of usersMinted.entries()) {
        try {
            const balanceTo = (await etherC.balanceOf(key, { blockTag: blockNumberTo })).toString();
            let balanceFrom = 0;
    
            const userRedeem = usersRedeemed.get(key) ?? "0";
    
            if (!balanceTo) return;
            if (blockNumberFrom !== 0) {
                balanceFrom = (await etherC.balanceOf(key, { blockTag: blockNumberFrom })).toString();
            };
    
            const balanceDiff = new BN(balanceTo).minus(balanceFrom);
            index += 1;
    
            if (index % 10 === 0) {
                console.log("Loading", index, " -> ", usersMinted.size)
            }
    
            const rebased = balanceDiff.minus(val).plus(userRedeem);
            usersRebaseProfit.set(key, rebased.toFixed());
        } catch(e) {
            console.log(e)
            console.log("ERROR FOR:", {
                address: key,
                blockNumberTo,
                blockNumberFrom
            })
            usersRebaseProfit.set(key, "0");
        }
    }

    const sortedMap = new Map([...usersRebaseProfit.entries()].sort((a, b) => new BN(a[1]).gt(b[1]) ? -1 : 1));

    // removing pools/working contracts
    sortedMap.forEach((_, key) => new BN(_).eq(0) ? sortedMap.delete(key) : null);
    exclude.forEach((_) => sortedMap.delete(_.toLowerCase()));

    console.log('Done...');

    return sortedMap;
}


export const getRebaseForUsersByPoolAtBlock = async ({
    blockNumberFrom,
    blockNumberTo,
    token
}: BlockDataRebase): Promise<Map<string, string>> => {
    if (!blockNumberFrom || !blockNumberTo) return new Map();
    console.log("INIT")

    const urlData = SUBGRAPH_URLS[CHAINS.LINEA][PROTOCOLS.OVN_REBASE]

    const slices = CHUNKS_SPLIT;
    const step = (blockNumberTo - blockNumberFrom) / slices;
    const blocksBatches = Array.from({ length: slices + 1 }).map((_, index) => {
        const blockNumber = blockNumberFrom + index * step;
        return Math.floor(blockNumber).toString();
    });
    const allDataRes: PositionRebase[] = [];

    // user address -> value of minted
    const usersMinted: Map<string, string> = new Map();

    // user address -> value of redeemed/transfered
    const usersRedeemed: Map<string, string> = new Map();


    console.log(blocksBatches, '___blocksBatches');
    const asyncLoad = async () => {
        for (let i = 0; i < blocksBatches.length; i++) {
            console.log('Batch done:', i + " from ", blocksBatches.length);
            console.log('usersMinted: ', usersMinted.size);
            await new Promise((res) => setTimeout(res, 10));
            const nextValue = blocksBatches[i + 1];
    
            const url = urlData[token].url;
            let result: PositionRebase[] = [];
            let whereQuery = `where: { blockNumber_gte: ${blocksBatches[i]}, blockNumber_lte: ${Number(nextValue) - 1}}`;
            let fetchNext = true;
            let skip = 0;
    
            if (!nextValue || !url) return [];
    
            while(fetchNext){
                let query = `{
                    transfers(${whereQuery} orderBy: value, first: 1000, skip: ${skip}) {
                        value
                        from
                        to
                        transactionHash
                    }
                }`;
    
                let response = await fetch(url, {
                    method: "POST",
                    body: JSON.stringify({ query }),
                    headers: { "Content-Type": "application/json" },
                });
                let data = await response.json();

                if (skip > 1000) {
                    console.log("skip > 1000: ", skip)
                }

                let positions = data.data.transfers;
                for (let i = 0; i < positions.length; i++) {
                    let position = positions[i];
                    const fromAddress = position.from.toLowerCase();
                    const toAddress = position.to.toLowerCase();

                    // redeem
                    if (fromAddress === ZERO_ADD) {
                        const data = usersMinted.get(toAddress);
                        usersMinted.set(toAddress, data ? new BN(data).plus(position.value).toFixed(0) : position.value);
                        continue;
                    }

                    // mint
                    if (toAddress === ZERO_ADD) {
                        const data = usersRedeemed.get(fromAddress);
                        usersRedeemed.set(fromAddress, data ? new BN(data).plus(position.value).toFixed(0) : position.value);
                        continue;
                    }

                    // transfer between accounts
                    if (![toAddress, fromAddress].includes(ZERO_ADD)) {
                        const dataFrom = usersRedeemed.get(fromAddress);
                        const dataTo = usersMinted.get(toAddress);
                        usersRedeemed.set(fromAddress, dataFrom ? new BN(dataFrom).plus(position.value).toFixed(0) : position.value);
                        usersMinted.set(toAddress, dataTo ? new BN(dataTo).plus(position.value).toFixed(0) : position.value);
                        continue;
                    }
                }
                if(positions.length < 1000){
                    fetchNext = false;
                }else{
                    skip += 1000;
                }
            }
    
            allDataRes.push(result.length as any)
        }
    }

    await asyncLoad();

    const listNetRebase = await countNetRebase(usersMinted, usersRedeemed, blockNumberFrom, blockNumberTo, urlData[token].address)
    if (!listNetRebase) return new Map()

    return listNetRebase;
}
    
// OVN pools
// 0x58aacbccaec30938cb2bb11653cad726e5c4194a usdc/usd+
// 0xc5f4c5c2077bbbac5a8381cf30ecdf18fde42a91 usdt+/usd+
export const getUserTVLByBlock = async ({
    blockNumber,
    blockTimestamp,
  }: BlockData): Promise<Position[]> => {
    let whereQuery = blockNumber ? `where: { blockNumber_lt: ${blockNumber} }` : "";
    const poolsData = SUBGRAPH_URLS[CHAINS.LINEA][PROTOCOLS.OVN]

    let skip = 0;
    let fetchNext = true;

    const allPoolsRes = await Promise.all(Object.values(poolsData).map(async (_) => {
        const url = _.url
        const poolId = _.address
        let result: Position[] = [];

        while(fetchNext){
            let query = `{
                deposits(${whereQuery} orderBy: amount, first: 1000,skip: ${skip}) {
                    id
                    amount
                    user
                    blockNumber
                }
            }`;

            let response = await fetch(url, {
                method: "POST",
                body: JSON.stringify({ query }),
                headers: { "Content-Type": "application/json" },
            });
            let data = await response.json();

            let positions = data.data.deposits;
            for (let i = 0; i < positions.length; i++) {
                let position = positions[i];
                let transformedPosition: Position = {
                    id: position.id,
                    liquidity: BigInt(position.amount),
                    owner: position.user,
                    address: poolId,
                };
                result.push(transformedPosition);
                
            }
            if(positions.length < 1000){
                fetchNext = false;
            }else{
                skip += 1000;
            }
        }

        return result
    }))

    return allPoolsRes.flat(1);
}

export const getLPValueByUserAndPoolFromPositions = (
    positions: Position[]
): Map<string, Map<string, BN>> => {
    let result = new Map<string, Map<string, BN>>();
    for (let i = 0; i < positions.length; i++) {
        let position = positions[i];
        let poolId = position.id;
        let owner = position.owner;
        let userPositions = result.get(owner);
        if (userPositions === undefined) {
            userPositions = new Map<string, BN>();
            result.set(owner, userPositions);
        }
        let poolPositions = userPositions.get(poolId);
        if (poolPositions === undefined) {
            poolPositions = BN(0);
        }

        poolPositions = poolPositions.plus(position.liquidity.toString());
        userPositions.set(poolId, poolPositions);
    }
    return result;
}

export const getTimestampAtBlock = async (blockNumber: number) => {
    const publicClient = createPublicClient({
      chain: extractChain({ chains: [linea], id: CHAINS.LINEA }),
      transport: http(RPC_URLS[CHAINS.LINEA]),
    });
  
    const block = await publicClient.getBlock({
      blockNumber: BigInt(blockNumber),
    });
    return Number(block.timestamp * 1000n);
  };
