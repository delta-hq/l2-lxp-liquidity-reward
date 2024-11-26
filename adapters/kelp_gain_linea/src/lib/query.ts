import { request } from "graphql-request";
import { gql } from "graphql-request";
import { fetchAllPendleShare } from "./pendle";
import { fetchAllBalancerShare } from "./balancer";
import { BigNumber } from "bignumber.js";
import { ethers } from "ethers";
import { agETH, AGETH_BLOCK, balancerVault, pendleSYAgETH } from "./utils";
import {
  fetchSpectraPoolShares,
  SPECTRA_LP_ADDRESS,
  SPECTRA_YT_ADDRESS
} from "./spectra";
import { agEthToRsEth, rsEthToAgEth } from "./fetcher";
import { getYayAgEthHodlers } from "./yay";
import {
  GraphQLQuery,
  PoolPositionSubgraphEntry,
  UserBalanceSubgraphEntry,
  UserPositionSubgraphEntry
} from "./models";
import { getCamelotAgEthHodlers } from "./camelot";
import { getNileAgEthHodlers } from "./nile";
import { getNuriAgEthHodlers } from "./nuri";

const MULTICALL_BATCH_SIZE = 1000;

const Blacklisted = [
  agETH,
  balancerVault,
  pendleSYAgETH,
  SPECTRA_LP_ADDRESS,
  SPECTRA_YT_ADDRESS
];
export const agETHSubgraph =
  "https://api.thegraph.com/subgraphs/id/QmQtVYZ1DLfEJBHVfbCkHF2pbuQRnH1U88VGX3WBWgxoii";
//
interface IDwise {
  id: string;
}

export async function subgraphFetchAllById<T extends IDwise>(
  endpoint: string,
  query: string,
  collection: string,
  variables: Record<string, unknown>
): Promise<T[]> {
  const data: T[] = [];
  let lastId = "0x0000000000000000000000000000000000000000";
  while (true) {
    const resp: { [collection: string]: T[] } = await request(endpoint, query, {
      ...variables,
      lastId
    });

    const batch: T[] = resp[collection];
    if (batch.length == 0) {
      break;
    }

    const last = batch[batch.length - 1];
    lastId = last.id;

    data.push(...batch);

    if (batch.length < MULTICALL_BATCH_SIZE) {
      break;
    }
  }
  return data;
}
export async function subgraphFetchOne<T>(
  endpoint: string,
  query: string,
  collection: string,
  variables: Record<string, unknown>
): Promise<T> {
  const resp: { [collection: string]: T } = await request(
    endpoint,
    query,
    variables
  );
  return resp[collection];
}

export const USER_BALANCES_QUERY: GraphQLQuery = {
  query: gql`
    query PositionsQuery($block: Int, $lastId: ID!, $blacklisted: [ID!]!) {
      userBalances(
        where: { balance_gt: "0", id_gt: $lastId, id_not_in: $blacklisted }
        block: { number: $block }
        orderBy: id
        orderDirection: asc
        first: 1000
      ) {
        id
        balance
      }
    }
  `,
  collection: "userBalances"
};

export async function getAllAgEthHodlers(
  ethBlockNumber: number,
  lineaBlockNumber: number,
  timestamp: number
) {
  if (ethBlockNumber < AGETH_BLOCK) {
    return [];
  }
  const positions = await subgraphFetchAllById<UserBalanceSubgraphEntry>(
    agETHSubgraph,
    USER_BALANCES_QUERY.query,
    USER_BALANCES_QUERY.collection,
    {
      block: ethBlockNumber,
      lastId: "0x0000000000000000000000000000000000000000",
      blacklisted: Blacklisted
    }
  );

  const [
    pendleShares,
    balancerShares,
    yayShares,
    camelotShares,
    nileShares,
    nuriShares,
    spectraShare
  ] = await Promise.all([
    fetchAllPendleShare(ethBlockNumber, timestamp),
    fetchAllBalancerShare(ethBlockNumber),
    getYayAgEthHodlers(ethBlockNumber),
    getCamelotAgEthHodlers(timestamp),
    getNileAgEthHodlers(lineaBlockNumber),
    getNuriAgEthHodlers(timestamp),
    fetchSpectraPoolShares(ethBlockNumber)
  ]);

  let agETHHodlers = positions.reduce((acc, s) => acc + BigInt(s.balance), 0n);

  let totalPendleShares = pendleShares.reduce(
    (acc, s) => acc + BigInt(s.share),
    0n
  );

  let totalBalancerShares = balancerShares.reduce(
    (acc, s) => acc.plus(BigNumber(s.balance)),
    new BigNumber(0)
  );

  let spectraShare_ = spectraShare.reduce(
    (acc, s) => acc.plus(BigNumber(s.balance)),
    new BigNumber(0)
  );

  let spectraAgETHBalance = ethers.utils.formatEther(
    spectraShare_.toFixed().toString()
  );

  const nuriAgETHBalance = nuriShares
    .reduce((acc, s) => acc.plus(BigNumber(s.balance)), new BigNumber(0))
    .toFixed()
    .toString();
  const nileAgETHBalance = nileShares
    .reduce((acc, s) => acc.plus(BigNumber(s.balance)), new BigNumber(0))
    .toFixed()
    .toString();
  const camelotAgETHBalance = camelotShares
    .reduce((acc, s) => acc.plus(BigNumber(s.balance)), new BigNumber(0))
    .toFixed()
    .toString();
  const yayAgETHBalance = yayShares
    .reduce((acc, s) => acc.plus(BigNumber(s.balance)), new BigNumber(0))
    .toFixed()
    .toString();
  console.log(
    `Hodlers agETH: ${ethers.utils.formatEther(agETHHodlers.toString())}`
  );
  console.log(
    `Pendle agETH: ${ethers.utils.formatEther(totalPendleShares.toString())}`
  );
  console.log(
    `Balancer agETH: ${ethers.utils
      .formatEther(totalBalancerShares.toFixed().toString())
      .toString()} `
  );
  console.log(`Spectra agETH: ${spectraAgETHBalance.toString()} `);

  console.log(
    `Nuri agETH: ${ethers.utils.formatEther(nuriAgETHBalance.toString())}`
  );

  console.log(
    `Nile agETH: ${ethers.utils.formatEther(nileAgETHBalance.toString())}`
  );

  console.log(
    `Camelot agETH: ${ethers.utils.formatEther(camelotAgETHBalance.toString())}`
  );

  console.log(
    `yay agETH: ${ethers.utils.formatEther(yayAgETHBalance.toString())}`
  );

  positions.push(...yayShares);
  positions.push(...nileShares);
  positions.push(...nuriShares);
  positions.push(...camelotShares);

  positions.push(
    ...pendleShares.map((e) => {
      return {
        id: e.user,
        balance: e.share
      };
    })
  );

  positions.push(
    ...balancerShares.map((e) => {
      return {
        id: e.userAddress.id,
        balance: e.balance
      };
    })
  );

  positions.push(...spectraShare);

  const balanceMap = new Map<string, bigint>();
  for (const balance of [...positions]) {
    balanceMap.set(
      balance.id,
      (balanceMap.get(balance.id) || 0n) + BigInt(balance.balance)
    );
  }

  const balances = Array.from(balanceMap, ([id, balance]) => ({
    id,
    balance: balance.toString()
  }));

  const allAgETH = balances.reduce((acc, s) => acc + BigInt(s.balance), 0n);
  console.log(`TOTAL agETH: ${ethers.utils.formatEther(allAgETH).toString()} `);
  return balances;
}
