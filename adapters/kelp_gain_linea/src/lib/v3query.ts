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
import { subgraphFetchAllById } from "./query";

export function getToken0And1(position: UserPositionSubgraphEntry) {
  let token0 = new BigNumber(0);
  let token1 = new BigNumber(0);
  if (!BigNumber(position.liquidity).isZero()) {
    token0 = BigNumber(position.depositedToken0).minus(
      BigNumber(position.withdrawnToken0)
    );
    token1 = BigNumber(position.depositedToken1).minus(
      BigNumber(position.withdrawnToken1)
    );
  }

  return { token0, token1 };
}

export function getAgEthBalance(
  position: UserPositionSubgraphEntry,
  pool: PoolPositionSubgraphEntry
) {
  const isToken0 = isToken0AgEth(pool);

  const { token0, token1 } = getToken0And1(position);

  return isToken0 ? token0 : token1;
}

export function getTotalAgEthInPool(pool: PoolPositionSubgraphEntry) {
  const isToken0 = isToken0AgEth(pool);

  return isToken0
    ? BigNumber(pool.pool.totalValueLockedToken0).multipliedBy(
        new BigNumber("1e18")
      )
    : BigNumber(pool.pool.totalValueLockedToken1).multipliedBy(
        new BigNumber("1e18")
      );
}

export function isToken0AgEth(pool: PoolPositionSubgraphEntry) {
  return pool.pool.token0.symbol.toLowerCase() === "ageth";
}

export async function getAllV3Share(
  blockNumber: number,
  subgraph: string,
  poolId: string
) {
  const [allPositions, poolPosition] = await Promise.all([
    getAllV3Positions(blockNumber, subgraph, poolId),
    getPoolPosition(blockNumber, subgraph, poolId)
  ]);

  const allAgETH = allPositions.reduce((prev, curr) => {
    const agETHBalance = getAgEthBalance(curr, poolPosition);
    return prev.plus(agETHBalance);
  }, new BigNumber(0));

  return allPositions.map((position) => {
    const owner = position.owner;

    const agETHBalance = getAgEthBalance(position, poolPosition);

    const userElShare = agETHBalance.div(allAgETH);
    const totalAgETH = getTotalAgEthInPool(poolPosition);

    return {
      id: owner,
      balance: userElShare.multipliedBy(totalAgETH).toFixed(0)
    };
  });
}
export async function getAllV3Positions(
  blockNumber: number,
  subgraph: string,
  poolId: string
) {
  const positions = await subgraphFetchAllById<UserPositionSubgraphEntry>(
    subgraph,
    USER_POSITIONS_QUERY.query,
    USER_POSITIONS_QUERY.collection,
    {
      poolId: poolId,
      block: blockNumber,
      lastId: "0x0000000000000000000000000000000000000000"
    }
  );
  return positions;
}

export async function getPoolPosition(
  blockNumber: number,
  subgraph: string,
  poolId: string
) {
  const poolPosition = await request<PoolPositionSubgraphEntry>(
    subgraph,
    POOL_POSITION_QUERY.query,
    {
      poolId: poolId,
      block: blockNumber
    }
  );
  return poolPosition;
}

export const USER_POSITIONS_QUERY: GraphQLQuery = {
  query: gql`
    query PositionsQuery($poolId: ID!, $block: Int, $lastId: ID!) {
      positions(
        where: { pool: $poolId, liquidity_gt: 0, id_gt: $lastId }
        block: { number: $block }
        first: 1000
        orderBy: id
        orderDirection: asc
      ) {
        id
        liquidity
        owner
        depositedToken0
        depositedToken1
        withdrawnToken0
        withdrawnToken1
      }
    }
  `,
  collection: "positions"
};

export const POOL_POSITION_QUERY: GraphQLQuery = {
  query: gql`
    query PoolPositionQuery($poolId: ID!, $block: Int) {
      pool(id: $poolId, block: { number: $block }) {
        liquidity
        totalValueLockedUSD
        totalValueLockedToken0
        totalValueLockedToken1
        token0Price
        token1Price
        token0 {
          symbol
        }
        token1 {
          symbol
        }
      }
    }
  `,
  collection: "pool"
};
