import { createPublicClient, extractChain, http } from "viem";
import { linea } from "viem/chains";
import { CHAINS, PROTOCOLS, RPC_URLS, SUBGRAPH_URLS } from "./config";

interface UserStake {
  id: string;
  balance: string;
  poolId: string;
  owner: string;
}
interface UserVote {
  id: string;
  balance: string;
  owner: string;
}

export const getUserStakesForAddressByPoolAtBlock = async (
  blockNumber: number,
  address: string,
  poolId: string
): Promise<UserStake[]> => {
  let subgraphUrl =
    SUBGRAPH_URLS[CHAINS.L2_CHAIN_ID][PROTOCOLS.VELOCORE][PROTOCOLS.VELOCORE];
  let blockQuery = blockNumber !== 0 ? ` block: {number: ${blockNumber}}` : ``;
  let poolQuery = poolId !== "" ? ` gauge: "${poolId.toLowerCase()}"` : ``;
  let ownerQuery = address !== "" ? `user: "${address.toLowerCase()}"` : ``;
  let balanceQuery = `balance_gt: "0"`;

  let whereQuery =
    ownerQuery !== "" && poolQuery !== ""
      ? `where: {${ownerQuery} , ${poolQuery}, ${balanceQuery}}`
      : ownerQuery !== ""
      ? `where: {${ownerQuery}, ${balanceQuery}}`
      : poolQuery !== ""
      ? `where: {${poolQuery}, ${balanceQuery}}`
      : `where: {${balanceQuery}}`;
  let skip = 0;
  let fetchNext = true;
  let result: UserStake[] = [];
  while (fetchNext) {
    let query = `
            query MyQuery {
              userStakes(${whereQuery} ${blockQuery} first:1000,skip:${skip}) {
                id
                balance
                gauge {
                  id
                }
                user {
                  id
                }
              }
            }`;

    let response = await fetch(subgraphUrl, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();
    let userStakes = data.data.userStakes;
    for (let i = 0; i < userStakes.length; i++) {
      let userStake = userStakes[i];
      let transformedUserStake: UserStake = {
        id: userStake.id,
        balance: userStake.balance,
        poolId: userStake.gauge.id,
        owner: userStake.user.id,
      };
      result.push(transformedUserStake);
    }
    if (userStakes.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }
  return result;
};

export const getUserVoteForAddressByPoolAtBlock = async (
  blockNumber: number,
  address: string
): Promise<UserVote[]> => {
  let subgraphUrl =
    SUBGRAPH_URLS[CHAINS.L2_CHAIN_ID][PROTOCOLS.VELOCORE][PROTOCOLS.VELOCORE];
  let blockQuery = blockNumber !== 0 ? ` block: {number: ${blockNumber}}` : ``;
  let ownerQuery = address !== "" ? `id: "${address.toLowerCase()}"` : ``;
  let balanceQuery = `vote_gt: "0"`;

  let whereQuery =
    ownerQuery !== ""
      ? `where: {${ownerQuery}, ${balanceQuery}}`
      : `where: {${balanceQuery}}`;
  let skip = 0;
  let fetchNext = true;
  let result: UserVote[] = [];
  while (fetchNext) {
    let query = `
            query MyQuery {
              users(${whereQuery} ${blockQuery} first:1000,skip:${skip}) {
                vote
                id
              }
            }`;

    let response = await fetch(subgraphUrl, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();
    let userVotes = data.data.users;
    for (let i = 0; i < userVotes.length; i++) {
      let userVote = userVotes[i];
      let transformedUserVote: UserVote = {
        id: userVote.id,
        balance: userVote.vote,
        owner: userVote.id,
      };
      result.push(transformedUserVote);
    }
    if (userVotes.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }
  return result;
};

export const getTimestampAtBlock = async (blockNumber: number) => {
  const publicClient = createPublicClient({
    chain: extractChain({ chains: [linea], id: CHAINS.L2_CHAIN_ID }),
    transport: http(RPC_URLS[CHAINS.L2_CHAIN_ID]),
  });

  const block = await publicClient.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};
