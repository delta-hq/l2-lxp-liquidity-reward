import { getBalanceAtBlock, getCurrentTickAtBlock } from "./chainReads";
import { CHAINS, PROTOCOLS, SUBGRAPH_URLS } from "./config";

export interface Depositor {
  id: string;
  shares: bigint;
  sender: string;
  vault: {
    id: string;
    pool: string;
  };
  blockNumber: number;
timestamp: number;
}

export type VaultPositions = {
  id: string
  vault: {
    id: string
  }
  upperTick: string[]
  lowerTick: string[]
}

// const vaultTokenQuery = `{
//   vaults(first: 1000) {
//     token1
//     token0
//     id
//   }
// }`

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

const query = `{
  vaultDeposits(first: 1000, where: {timeStamp_lte: "", vault_: {id: ""}}) {
    executor
    timeStamp
    vault {
      id
    }
  }
}`

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
    vaultPositions(where:{vault: "${vaultId}", timestamp_lte: "${timestamp}"}, first: 5, orderDirection: desc, orderBy: timestamp) {
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

interface VaultPool {
  vault: string;
  pool: string;
}

export async function getVaultsCreatedBefore(
  chainId: CHAINS,
  protocol: PROTOCOLS,
  timestamp: number,
): Promise<VaultPool[]> {
  let subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
  const query = `{
  vaults(first: 1000, where: {createdAt_lte: "${timestamp}", pool_not: ""}) {
      id
      pool
    }
  }`
  
  let response = await fetch(subgraphUrl, {
    method: "POST",
    body: JSON.stringify({ query }),
    headers: { "Content-Type": "application/json" },
  });

  let data: any = await response.json();

  let vaultIds = data.data.vaults || [];
  return vaultIds.map((vault: {id: string, pool: string}) => {return {vault: vault.id, pool: vault.pool}})
}

interface UserHolding {
  sender: string;
  shares: string;
}

export async function getUserSharesByVaultAtTime(
  chainId: CHAINS,
  protocol: PROTOCOLS,
  vaultId: string,
  timestamp: number,
): Promise<{ [sender: string]: bigint }> {
  let subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
  const withdrawQuery = `{
  vaultWithdraws(where: {timeStamp_lte: "${timestamp}", vault_: {id: "${vaultId}"}}, first: 1000) {
    sender
    shares
  }
}`

const depositQuery = `{
  vaultDeposits(first: 1000, where: {timeStamp_lte: "${timestamp}", vault_: {id: "${vaultId}"}}) {
    sender
    shares
  }
}`

let response = await fetch(subgraphUrl, {
  method: "POST",
  body: JSON.stringify({ query: depositQuery }),
  headers: { "Content-Type": "application/json" },
});

let data: any = await response.json();

const vaultDeposits: UserHolding[] = data.data.vaultDeposits || [];

response = await fetch(subgraphUrl, {
  method: "POST",
  body: JSON.stringify({ query: withdrawQuery }),
  headers: { "Content-Type": "application/json" },
});

data = await response.json();

const vaultWithdraws: UserHolding[] = data.data.vaultWithdraws || [];

  // Aggregate the net holdings of shares for each user
  const userShares: { [sender: string]: bigint } = {};

  // Process deposits
  for (const deposit of vaultDeposits) {
    const shares = BigInt(deposit.shares);
    if (userShares[deposit.sender]) {
      userShares[deposit.sender] += shares;
    } else {
      userShares[deposit.sender] = shares;
    }
  }

  // Process withdrawals
  for (const withdraw of vaultWithdraws) {
    const shares = BigInt(withdraw.shares);
    if (userShares[withdraw.sender]) {
      userShares[withdraw.sender] -= shares;
    } else {
      userShares[withdraw.sender] = -shares;
    }
  }

  return userShares;
}



export async function getDepositors(  
  blockNumber: number,
  blockTimestamp: number,
  address: string,
  vaultId: string,
  chainId: CHAINS,
  protocol: PROTOCOLS
): Promise<Depositor[]> {
  let subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
  // let blockQuery = blockNumber !== 0 ? ` blockNumber: ${blockNumber}}` : ``;
  // let poolQuery =
  //   vaultId !== "" ? ` vault_:{id: "${vaultId.toLowerCase()}"}` : ``;
  // let ownerQuery = address !== "" ? `account: "${address.toLowerCase()}"` : ``;

  // let whereQuery =
  //   ownerQuery !== "" && poolQuery !== ""
  //     ? `where: {${ownerQuery} , ${poolQuery}}`
  //     : ownerQuery !== ""
  //     ? `where: {${ownerQuery}}`
  //     : poolQuery !== ""
  //     ? `where: {${poolQuery}}`
  //     : ``;

  // if (blockQuery !== "" && whereQuery === "") {
  //   whereQuery = `where: {`;
  // }
  let skip = 0;
  let fetchNext = true;
  let result: Depositor[] = [];

      // get unique pools and fetch all current ticks
      const poolSet = new Set<string>()
      const vaultSet = new Set<string>()
      const vaultToPool = new Map()
  while (fetchNext) {
    let query = `{
        vaultDeposits(where: {timeStamp_lte: "${blockTimestamp}"}, orderBy: timeStamp, first:1000, skip:${skip}) {
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
    result.push(...depositors)
    if (depositors.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }

  for (let i = 0; i < result.length; i++) {
    const element = result[i];
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

  // get users bal who might be in the in range vaults
  const userVaultBalMap = new Map()
  for (let i = 0; i < result.length; i++) {
    if (!userVaultBalMap.has(result[i].sender + result[i].vault.id)) {
      const userBalance = await getBalanceAtBlock(result[i].vault.id, result[i].sender, blockNumber)
      userVaultBalMap.set(result[i].sender + result[i].vault.id, userBalance.balance)
      result[i].shares = userBalance.balance
    }
    else {
      result[i].shares = userVaultBalMap.get(result[i].sender + result[i].vault.id)
    }
  }


  for (let i = 0; i < result.length; i++) {
    let depositor = result[i];
    let transformedPosition: Depositor = {
      id: depositor.id,
      shares: BigInt(depositor.shares),
      sender: depositor.sender,
      vault: {
        id: depositor.vault.id,
        pool: depositor.vault.pool,
      },
      blockNumber: blockNumber,
      timestamp: blockTimestamp
    };
    if (vaultInRange.get(depositor.vault.id) && depositor.shares > 0) result.push(transformedPosition);
  }

  return result;
}


// export async function getVaultPositions(
//   chainId: CHAINS,
//   protocol: PROTOCOLS,
//   vaultId: string
// ): Promise<VaultPositions[]> {
//   let subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
//   const query = `{
//     vaultPositions(where:{vault: "${vaultId}"}, first: 1) {
//         id
//         vault {
//           id
//         }
//         upperTick
//         lowerTick
//       }
//     }
//     `;

//   let response = await fetch(subgraphUrl, {
//     method: "POST",
//     body: JSON.stringify({ query }),
//     headers: { "Content-Type": "application/json" },
//   });

//   let data: any = await response.json();

//   let vaultPositions = data.data.vaultPositions || [];

//   return vaultPositions;
// }

// export async function getAllPotentialHoldersByVaultAtBlock(
//   blockTimestamp: number,
//   address: string,
//   vaultId: string,
//   chainId: CHAINS,
//   protocol: PROTOCOLS
// ): Promise<string[]> {
//   let subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
//   let skip = 0;
//   let fetchNext = true;
//   let result: Depositor[] = [];
//   while (fetchNext) {
//   const query = `{
//     vaultDeposits(first: 1000, where: {timeStamp_lte: "${blockTimestamp }"}, skip:${skip})) {
//       executor
//       timeStamp
//       vault {
//         id
//       }
//     }
//   }`

//   let response = await fetch(subgraphUrl, {
//     method: "POST",
//     body: JSON.stringify({ query }),
//     headers: { "Content-Type": "application/json" },
//   });

//   let data: any = await response.json();
//   if (depositors.length < 1000) {
//     fetchNext = false;
//   } else {
//     skip += 1000;
//   }

//   let depositors = data.data.vaultDeposits || [];
// } }

// export const getDepositorsForAddressByVaultAtBlock = async (
//   blockNumber: number,
//   blockTimestamp: number,
//   address: string,
//   vaultId: string,
//   chainId: CHAINS,
//   protocol: PROTOCOLS
// ): Promise<Depositor[]> => {
//   let subgraphUrl = SUBGRAPH_URLS[chainId][protocol];
//   let blockQuery = blockNumber !== 0 ? ` blockNumber: ${blockNumber}}` : ``;
//   let poolQuery =
//     vaultId !== "" ? ` vault_:{id: "${vaultId.toLowerCase()}"}` : ``;
//   let ownerQuery = address !== "" ? `account: "${address.toLowerCase()}"` : ``;

//   let whereQuery =
//     ownerQuery !== "" && poolQuery !== ""
//       ? `where: {${ownerQuery} , ${poolQuery}}`
//       : ownerQuery !== ""
//       ? `where: {${ownerQuery}}`
//       : poolQuery !== ""
//       ? `where: {${poolQuery}}`
//       : ``;

//   if (blockQuery !== "" && whereQuery === "") {
//     whereQuery = `where: {`;
//   }
//   let skip = 0;
//   let fetchNext = true;
//   let result: Depositor[] = [];
//   while (fetchNext) {
//     let query = `{
//         vaultDeposits(${whereQuery} ${blockQuery} orderBy: timeStamp, first:1000,skip:${skip}) {
//                 id
//                 shares
//                 sender
//                 vault {
//                   id
//                   pool
//                 }
//                 blockNumber
//             }
//         }`;

//     let response = await fetch(subgraphUrl, {
//       method: "POST",
//       body: JSON.stringify({ query }),
//       headers: { "Content-Type": "application/json" },
//     });

//     let data: any = await response.json();

//     let depositors = data.data.vaultDeposits || [];

//     // get unique pools and fetch all current ticks
//     const poolSet = new Set<string>()
//     const vaultSet = new Set<string>()
//     const vaultToPool = new Map()
//     for (let i = 0; i < depositors.length; i++) {
//       const element = depositors[i];
//       poolSet.add(element.vault.pool)
//       vaultSet.add(element.vault.id)
//       vaultToPool.set(element.vault.id, element.vault.pool)
//     }

//     // fetch all ticks
//     const poolArray = Array.from(poolSet) 
//     const poolTickMap = new Map()
//     for (let i = 0; i < poolArray.length; i++) {
//       const tick = await getCurrentTickAtBlock(poolArray[i],blockNumber)
//       poolTickMap.set(poolArray[i], tick)
//     }

//     // check if all vaults are in range
//     const vaultArray = Array.from(vaultSet)
//     const vaultInRange = new Map()
//     for (let i = 0; i < vaultArray.length; i++) {
//       const inRange = await checkMostRecentVaultPositionsInRange(
//         chainId, 
//         protocol, 
//         vaultArray[i], 
//         blockTimestamp, 
//         poolTickMap.get(vaultToPool.get(vaultArray[i]))
//       )
//       vaultInRange.set(vaultArray[i], inRange)
//     }



//     for (let i = 0; i < depositors.length; i++) {
//       let depositor = depositors[i];
//       let transformedPosition: Depositor = {
//         id: depositor.id,
//         shares: BigInt(depositor.shares),
//         account: depositor.sender,
//         vault: {
//           id: depositor.vault.id,
//           pool: depositor.vault.pool,
//         },
//         blockNumber: depositor.blockNumber,
//       };
//       if (vaultInRange.get(depositor.vault.id)) result.push(transformedPosition);
//     }
//     if (depositors.length < 1000) {
//       fetchNext = false;
//     } else {
//       skip += 1000;
//     }
//   }
//   return result;
// };