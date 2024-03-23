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
      result.push(transformedPosition);
    }
    if (depositors.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }
  return result;
};
