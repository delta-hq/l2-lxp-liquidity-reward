import { getCurrentTickAtBlock } from "./chainReads";
import { CHAINS, PROTOCOLS, SUBGRAPH_URLS } from "./config";

export interface Depositor {
  id: string;
  shares: bigint;
  account: string;
  vault: {
    id: string;
    pool: string;
  };
  blockNumber: string;
}

export type VaultPositions = {
  id: string
  vault: {
    id: string
  }
  upperTick: string[]
  lowerTick: string[]
}

const vaultTokenQuery = `{
  vaults(first: 1000) {
    token1
    token0
    id
  }
}`

export type VaultSnapshot = {
  totalSupply: bigint;
  totalAmount0: bigint;
  totalAmount1: bigint;
  timestamp: string;
  id: string;
}

export type VaultTokens = {
  id: string
  token0: string
  token1: string
}

export async function checkMostRecentVaultPositionsInRange(
  chainId: CHAINS,
  protocol: PROTOCOLS,
  vaultId: string,
  timestamp: number,
  tick: number
// ): Promise<VaultPositions[]> {
): Promise<boolean> {
  let subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
  const query = `{
    vaultPositions(where:{vault: "${vaultId}", timestamp_lte: "${timestamp}"}, first: 10, orderDirection: desc, orderBy: timestamp) {
        id
        vault {
          id
        }
        upperTick
        lowerTick
        timestamp
      }
    }
    `;

  let response = await fetch(subgraphUrl, {
    method: "POST",
    body: JSON.stringify({ query }),
    headers: { "Content-Type": "application/json" },
  });

  let data: any = await response.json();

  let vaultPositions = data.data.vaultPositions || [];
  // filter to just latest grouping
  const highestTimestamp = Math.max(...vaultPositions.map((position: { timestamp: string; }) => Number(position.timestamp)));
  const highestTimestampPositions = vaultPositions.filter((position: { timestamp: string; }) => Number(position.timestamp) === highestTimestamp);

  return highestTimestampPositions.some((position: { lowerTick: any; upperTick: any; }) => Number(position.lowerTick) <= tick && Number(position.upperTick) >= tick);

  // return highestTimestampPositions;
}

export async function getVaultPositions(
  chainId: CHAINS,
  protocol: PROTOCOLS,
  vaultId: string
): Promise<VaultPositions[]> {
  let subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
  const query = `{
    vaultPositions(where:{vault: "${vaultId}"}, first: 1) {
        id
        vault {
          id
        }
        upperTick
        lowerTick
      }
    }
    `;

  let response = await fetch(subgraphUrl, {
    method: "POST",
    body: JSON.stringify({ query }),
    headers: { "Content-Type": "application/json" },
  });

  let data: any = await response.json();

  let vaultPositions = data.data.vaultPositions || [];

  return vaultPositions;
}

export const getDepositorsForAddressByVaultAtBlock = async (
  blockNumber: number,
  blockTimestamp: number,
  address: string,
  vaultId: string,
  chainId: CHAINS,
  protocol: PROTOCOLS
): Promise<Depositor[]> => {
  let subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
  let blockQuery = blockNumber !== 0 ? ` blockNumber: ${blockNumber}}` : ``;
  let poolQuery =
    vaultId !== "" ? ` vault_:{id: "${vaultId.toLowerCase()}"}` : ``;
  let ownerQuery = address !== "" ? `account: "${address.toLowerCase()}"` : ``;

  let whereQuery =
    ownerQuery !== "" && poolQuery !== ""
      ? `where: {${ownerQuery} , ${poolQuery}}`
      : ownerQuery !== ""
      ? `where: {${ownerQuery}}`
      : poolQuery !== ""
      ? `where: {${poolQuery}}`
      : ``;

  if (blockQuery !== "" && whereQuery === "") {
    whereQuery = `where: {`;
  }
  let skip = 0;
  let fetchNext = true;
  let result: Depositor[] = [];
  while (fetchNext) {
    let query = `{
        vaultDeposits(${whereQuery} ${blockQuery} orderBy: timeStamp, first:1000,skip:${skip}) {
                id
                shares
                sender
                vault {
                  id
                  pool
                }
                blockNumber
            }
        }`;

    let response = await fetch(subgraphUrl, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });

    let data: any = await response.json();

    let depositors = data.data.vaultDeposits || [];

    // get unique pools and fetch all current ticks
    const poolSet = new Set<string>()
    const vaultSet = new Set<string>()
    const vaultToPool = new Map()
    for (let i = 0; i < depositors.length; i++) {
      const element = depositors[i];
      poolSet.add(element.vault.pool)
      vaultSet.add(element.vault.id)
      vaultToPool.set(element.vault.id, element.vault.pool)
    }

    // fetch all ticks
    const poolArray = Array.from(poolSet) 
    const poolTickMap = new Map()
    for (let i = 0; i < poolArray.length; i++) {
      const tick = await getCurrentTickAtBlock(poolArray[i],blockNumber)
      poolTickMap.set(poolArray[i], tick)
    }

    // check if all vaults are in range
    const vaultArray = Array.from(vaultSet)
    const vaultInRange = new Map()
    for (let i = 0; i < vaultArray.length; i++) {
      const inRange = await checkMostRecentVaultPositionsInRange(
        chainId, 
        protocol, 
        vaultArray[i], 
        blockTimestamp, 
        poolTickMap.get(vaultToPool.get(vaultArray[i]))
      )
      vaultInRange.set(vaultArray[i], inRange)
    }



    for (let i = 0; i < depositors.length; i++) {
      let depositor = depositors[i];
      let transformedPosition: Depositor = {
        id: depositor.id,
        shares: BigInt(depositor.shares),
        account: depositor.sender,
        vault: {
          id: depositor.vault.id,
          pool: depositor.vault.pool,
        },
        blockNumber: depositor.blockNumber,
      };
      if (vaultInRange.get(depositor.vault.id)) result.push(transformedPosition);
    }
    if (depositors.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }
  return result;
};
