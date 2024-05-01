import BN from "bignumber.js";
import { LINEA_RPC, CHAINS, OVN_CONTRACTS, PROTOCOLS, RPC_URLS, SUBGRAPH_URLS, ZERO_ADD, CHUNKS_SPLIT, BLOCK_STEP, LP_LYNEX, LP_LYNEX_SYMBOL, USD_PLUS_SYMBOL, USD_PLUS_LINEA, USDT_PLUS_LINEA, USDT_PLUS_SYMBOL } from "./config";
import { createPublicClient, extractChain, http } from "viem";
import { linea } from "viem/chains";
import { ethers } from "ethers";
import { ERC20_ABI } from "./abi";
import { CSVRow } from "..";

export interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

export interface BlockDataRebase {
    blockNumber: number;
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
    console.log('Counting net rebases for users...', `from ${blockNumberFrom} -> to ${blockNumberTo}`);

    const asyncBalanceCheck = async (key: string, val: string) => {
        try {
            const balanceTo = (await etherC.balanceOf(key, { blockTag: blockNumberTo })).toString();
            let balanceFrom = 0;
    
            const userRedeem = usersRedeemed.get(key) ?? "0";
    
            if (!balanceTo) return;
            if (new BN(blockNumberFrom).gt(0)) {
                balanceFrom = (await etherC.balanceOf(key, { blockTag: blockNumberFrom })).toString();
            };
    
            const balanceDiff = new BN(balanceTo).minus(balanceFrom);
            index += 1;
    
            if (index % 10 === 0) {
                console.log("Loading", index, " -> ", usersMinted.size)
            }
    
            // rebase counting
            // const rebased = balanceDiff.minus(val).plus(userRedeem).plus(balanceTo);
            // const valToSave = rebased.gt(0) ? rebased.toFixed() : "0";

            usersRebaseProfit.set(key, balanceTo);
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

    const processMapBatched = async () => {
        const batchSize = 100;
        const keys = Array.from(usersMinted.keys());
    
        for (let i = 0; i < keys.length; i += batchSize) {
            const batch = keys.slice(i, i + batchSize);
            const promises = batch.map(async (key) => {
                const val = usersMinted.get(key);

                if (!val) return null;
                return await asyncBalanceCheck(key, val);
            });
            await Promise.all(promises);
        }
    };

    await processMapBatched()

    const sortedMap = new Map([...usersRebaseProfit.entries()].sort((a, b) => new BN(a[1]).gt(b[1]) ? -1 : 1));

    // removing pools/working contracts
    sortedMap.forEach((_, key) => new BN(_).eq(0) ? sortedMap.delete(key) : null);
    exclude.forEach((_) => sortedMap.delete(_.toLowerCase()));

    console.log('Done...');

    return sortedMap;
}
  
export const getRebaseForUsersByPoolAtBlock = async ({
    blockNumber,
    token
}: BlockDataRebase): Promise<Map<string, string>> => {
    if (!blockNumber) return new Map();

    const blockNumberFrom = 0;
    const blockNumberTo = blockNumber;

    const urlData = SUBGRAPH_URLS[CHAINS.LINEA][PROTOCOLS.OVN_REBASE];

    const blockStep = BLOCK_STEP;
    const step = (blockNumberTo - blockNumberFrom) / blockStep;
    const blocksList = Array.from({ length: blockStep + 1 }).map((_, index) => {
        const blockNumber = blockNumberFrom + index * step;
        return Math.floor(blockNumber).toString();
    });

    console.log('Blocks to index: ', blocksList)

    const batchSize = Math.ceil(blocksList.length / CHUNKS_SPLIT);
    const chunkedBlocks: string[][] = [];

    for (let i = 0; i < blocksList.length; i += batchSize - 1) {
      const batch = blocksList.slice(i, i + batchSize);
      chunkedBlocks.push(batch);
    }
    
    const url = urlData[token].url;

    // user address -> value of minted
    const usersMintedTotal: Map<string, string> = new Map();
    // user address -> value of redeemed/transfered
    const usersRedeemedTotal: Map<string, string> = new Map();
    
    const asyncLoad = async () => {
        const totalData = await Promise.all(chunkedBlocks.map(async (item, i) => {
            return new Promise(async (res) => {
                // user address -> value of minted
                const usersMinted: Map<string, string> = new Map();
                // user address -> value of redeemed/transfered
                const usersRedeemed: Map<string, string> = new Map();
                
                for (let j = 0; j < chunkedBlocks[i].length; j++) {
                    console.log(`Batch ${i} done:`, j + " from ", chunkedBlocks[i].length);
                    const nextValue = chunkedBlocks[i][j + 1];
            
                    let whereQuery = `where: { blockNumber_gte: ${chunkedBlocks[i][j]}, blockNumber_lte: ${Number(nextValue) - 1}}`;
                    let fetchNext = true;
                    let skip = 0;

                    if (!nextValue || !url || new BN(nextValue).isNaN()) continue;
            
                    while(fetchNext){
                        let query = `{
                            transfers(${whereQuery} orderBy: value, first: 1000, skip: ${skip}) {
                                value
                                from
                                to
                            }
                        }`;
            
                        let response = await fetch(url, {
                            method: "POST",
                            body: JSON.stringify({ query }),
                            headers: { "Content-Type": "application/json" },
                        });
                        let data = await response.json();
        
                        if (skip > 1000) {
                            console.log(`Batch ${i}-${j}:`, " skip > 1000: ", skip)
                        }
        
                        let positions = data.data.transfers;
                        for (let k = 0; k < positions.length; k++) {
                            let position = positions[k];
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
                }

                res({
                    mint: usersMinted,
                    redeem: usersRedeemed
                })
            })
        }))

        totalData.forEach((usersData: any) => {
            usersData?.mint?.forEach((val: string, key: string) => {
                const data = usersMintedTotal.get(key);
                usersMintedTotal.set(key, data ? new BN(data).plus(val).toFixed(0) : val)
            })
            usersData?.redeem?.forEach((val: string, key: string) => {
                const data = usersRedeemedTotal.get(key);
                usersRedeemedTotal.set(key, data ? new BN(data).plus(val).toFixed(0) : val)
            })
        })
    }

    await asyncLoad();

    console.log('usersMinted: ', usersMintedTotal.size);
    const listNetRebase = await countNetRebase(usersMintedTotal, usersRedeemedTotal, blockNumberFrom, blockNumberTo, urlData[token].address)
    if (!listNetRebase) return new Map()

    return listNetRebase;
}

// OVN pools
// 0x58aacbccaec30938cb2bb11653cad726e5c4194a usdc/usd+
// 0xc5f4c5c2077bbbac5a8381cf30ecdf18fde42a91 usdt+/usd+
const getPoolsData = async (blockNumber: number, blockTimestamp: number): Promise<CSVRow[]> => {
    if (new BN(blockNumber).eq(0)) return [];
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

    const positions = allPoolsRes.flat(1);
    
    console.log("Positions: ", positions.length);
    let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positions);
    const csvRows: CSVRow[] = [];

    lpValueByUsers.forEach((value, key) => {
      value.forEach((lpValue) => {
          const lpValueStr = lpValue.toString();
          // Accumulate CSV row data
          csvRows.push({
            block_number: blockNumber,
            timestamp: blockTimestamp,
            user_address: key.toLowerCase(),
            token_address: LP_LYNEX,
            token_balance: BigInt(lpValueStr),
            token_symbol: LP_LYNEX_SYMBOL,
            usd_price: 0
        });
      })
    });

    return csvRows;
}

// counting rebase by blocks range
// [0, 100, 200] -> gonna be counted like [0, 100] + [100, 200]
const getRebaseData = async (block: number, blockTimestamp: number): Promise<CSVRow[]> => {
    console.log(`Blocks: 0 -> ${block}`);
    const csvRows: CSVRow[] = [];

    const positionsRebaseUsd = await getRebaseForUsersByPoolAtBlock({
      blockNumber: block,
      token: OVN_CONTRACTS.USDPLUS
    });

    const positionsRebaseUsdt = await getRebaseForUsersByPoolAtBlock({
      blockNumber: block,
      token: OVN_CONTRACTS.USDTPLUS
    });

    console.log("positionsRebase: ", positionsRebaseUsd.size);

    positionsRebaseUsd.forEach((value, key) => {
      csvRows.push({
        block_number: block,
        timestamp: blockTimestamp,
        user_address: key.toLowerCase(),
        token_address: USD_PLUS_LINEA,
        token_balance: BigInt(value),
        token_symbol: USD_PLUS_SYMBOL,
        usd_price: 0
      });
    });
    positionsRebaseUsdt.forEach((value, key) => {
      csvRows.push({
        block_number: block,
        timestamp: blockTimestamp,
        user_address: key.toLowerCase(),
        token_address: USDT_PLUS_LINEA,
        token_balance: BigInt(value),
        token_symbol: USDT_PLUS_SYMBOL,
        usd_price: 0
      });
    });

    return csvRows;
}

export const getUserTVLByBlock = async ({
    blockNumber,
    blockTimestamp,
  }: BlockData): Promise<CSVRow[]> => {
    const poolsCsv = await getPoolsData(blockNumber, blockTimestamp);
    const rebaseCsv = await getRebaseData(blockNumber, blockTimestamp);

    return poolsCsv.concat(rebaseCsv);
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
