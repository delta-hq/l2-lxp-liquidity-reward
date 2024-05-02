import { createPublicClient, extractChain, http } from "viem";
import { linea } from "viem/chains";
import { SUBGRAPH_URLS, CHAINS, RPC_URLS } from "./config";

export interface UserBalanceSnapshot {
  id: string;
  balance: number;
  token  : string;
  typeId : number;
}

export const getUserBalanceSnapshotAtBlock = async (
  blockNumber: number,
  address: string
): Promise<UserBalanceSnapshot[]> => {
  let subgraphUrl = SUBGRAPH_URLS[CHAINS.LINEA];
  let blockQuery = blockNumber !== 0 ? ` block: {number: ${blockNumber}}` : ``;

  let idQuery = address !== "" ? `id: "${address.toLowerCase()}"` : ``;
  let showZeroBalances = false;
  let balanceNotZeroQuery = showZeroBalances ? "" : `balance_gt: 0`;
  let whereQueries = [idQuery, balanceNotZeroQuery];
  let whereQuery = `where: {${whereQueries.filter((x) => x !== "").join(",")}}`;

  let skip = 0;
  let fetchNext = true;
  let result: UserBalanceSnapshot[] = [];

  while (fetchNext) {
    let query = `{
            users(
                ${whereQuery}
                ${blockQuery}
                orderBy: balance
                orderDirection: desc
                first:1000,skip:${skip}
            ){
              id
              balance
              token
              typeId
            }
          }
          `;

    let response = await fetch(subgraphUrl, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();
    let snapshots = data.data.users;
    for (const snapshot of snapshots) {
      let userBalanceSnapshot: UserBalanceSnapshot = {
        id: snapshot.id,
        balance: snapshot.balance,
        token  : snapshot.token,
        typeId : snapshot.typeId,
      };
      result.push(userBalanceSnapshot);
    }
    if (snapshots.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }
  return result;
};

export const getTimestampAtBlock = async (blockNumber: number) => {
  const publicClient = createPublicClient({
    chain: extractChain({ chains: [linea], id: linea.id }),
    transport: http(RPC_URLS[CHAINS.LINEA]),
  });

  const block = await publicClient.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};