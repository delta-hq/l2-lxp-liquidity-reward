import { V3_SUBGRAPH_URL, VFAT_SUBGRAPH_URL, client } from './config';
import { UserPosition } from './types';
import { Abi } from 'viem';

type V3Position = {
  id: string;
  liquidity: string;
  owner: string;
  pool: {
    sqrtPrice: string;
    tick: string;
    token0: {
      id: string;
      symbol: string;
    };
    token1: {
      id: string;
      symbol: string;
    };
    token0Price: string;
    token1Price: string;
  };
  tickLower: {
    tickIdx: string;
  };
  tickUpper: {
    tickIdx: string;
  };
};

const getV3PositionReserves = (position: V3Position) => {
  const liquidity = +position.liquidity;
  const _sqrtPrice = +position.pool.sqrtPrice;
  const currentTick = +position.pool.tick;
  const tickLower = +position.tickLower.tickIdx;
  const tickUpper = +position.tickUpper.tickIdx;

  let reserve0 = 0n;
  let reserve1 = 0n;

  if (liquidity === 0) {
    return {
      reserve0,
      reserve1,
    };
  }

  const sqrtRatioA = Math.sqrt(1.0001 ** tickLower);
  const sqrtRatioB = Math.sqrt(1.0001 ** tickUpper);
  const sqrtPrice = _sqrtPrice / 2 ** 96;

  if (currentTick >= tickLower && currentTick < tickUpper) {
    reserve0 = BigInt(
      Math.floor(
        liquidity *
          ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB)),
      ),
    );
    reserve1 = BigInt(
      Math.floor(liquidity * (sqrtPrice - sqrtRatioA)),
    );
  }

  return {
    reserve0,
    reserve1,
  };
};
const masterChefAddress =
  '0x22e2f236065b780fa33ec8c4e58b99ebc8b55c57';

export const getV3UserPositionsAtBlock = async (
  blockNumber: number,
): Promise<UserPosition[]> => {
  const resultMap = new Map<string, UserPosition>();

  let skip = '0';
  let fetchNext = true;
  while (fetchNext) {
    const query = `query {
            positions(
                first: 1000,
                where: { liquidity_gt: 0, id_gt: ${skip} },
                block: { number: ${blockNumber} },
                orderBy: id
            ) {
                id
                liquidity
                owner
                pool {
                    sqrtPrice
                    tick
                    token0 {
                        id
                        symbol
                    }
                    token1 {
                        id
                        symbol
                    }
                    token0Price
                    token1Price
                }
                tickLower {
                    tickIdx
                }
                tickUpper {
                    tickIdx
                }
            }
        }`;

    const response = await fetch(V3_SUBGRAPH_URL, {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    });

    const { data } = await response.json();

    const { positions } = data as { positions: V3Position[] };

    for (const position of positions) {
      const { reserve0, reserve1 } = getV3PositionReserves(position);

      resultMap.set(position.id, {
        user: position.owner,
        positionId: position.id,
        token0: {
          address: position.pool.token0.id,
          balance: reserve0,
        },
        token1: {
          address: position.pool.token1.id,
          balance: reserve1,
        },
      });
    }

    if (positions.length < 1000) {
      fetchNext = false;
    } else {
      skip = positions[positions.length - 1].id;
    }
  }

  const ownedByMasterChef = [...resultMap.values()].filter(
    (p) => p.user === masterChefAddress,
  );

  const owners = await getOwnerFromMasterChef(
    ownedByMasterChef.map((p) => p.positionId),
    BigInt(blockNumber),
  );

  for (const [index, owner] of owners.entries()) {
    const pid = ownedByMasterChef[index].positionId;

    resultMap.set(pid, {
      ...ownedByMasterChef[index],
      user: owner.toLowerCase(),
    });
  }

  return [...resultMap.values()];
};

export const getSickles = async () => {
  const query = `query fetchSickles {
        sickleAddresses {
            sickle
        }
    }`;

  const response = await fetch(VFAT_SUBGRAPH_URL, {
    method: 'POST',
    body: JSON.stringify({ query }),
    headers: { 'Content-Type': 'application/json' },
  });

  const { data } = await response.json();

  return (data as { sickleAddresses: { sickle: `0x${string}` }[] }).sickleAddresses;
}

const getOwnerFromMasterChef = async (
  pids: string[],
  blockNumber: bigint,
) => {
  const abi = [
    {
      inputs: [
        { internalType: 'uint256', name: '', type: 'uint256' },
      ],
      name: 'userPositionInfos',
      outputs: [
        {
          internalType: 'uint128',
          name: 'liquidity',
          type: 'uint128',
        },
        {
          internalType: 'uint128',
          name: 'boostLiquidity',
          type: 'uint128',
        },
        { internalType: 'int24', name: 'tickLower', type: 'int24' },
        { internalType: 'int24', name: 'tickUpper', type: 'int24' },
        {
          internalType: 'uint256',
          name: 'rewardGrowthInside',
          type: 'uint256',
        },
        { internalType: 'uint256', name: 'reward', type: 'uint256' },
        { internalType: 'address', name: 'user', type: 'address' },
        { internalType: 'uint256', name: 'pid', type: 'uint256' },
        {
          internalType: 'uint256',
          name: 'boostMultiplier',
          type: 'uint256',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  const results = await client.multicall({
    allowFailure: false,
    blockNumber,
    contracts: pids.map(
      (pid) =>
        ({
          abi,
          address: masterChefAddress,
          functionName: 'userPositionInfos',
          args: [BigInt(pid)],
        } as const),
    ),
  });

  return results.map((r) => {
    return r[6];
  });
};

export const getSickleOwners = async (sickleAddresses: `0x${string}`[]): Promise<Record<string, string>> => {
  const abi: Abi = [
    {
      inputs: [],
      name: 'owner',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  const results = await client.multicall({
    allowFailure: false,
    contracts: sickleAddresses.map(
      (sickle) =>
        ({
          abi,
          address: sickle,
          functionName: 'owner',
          args: [],
        } as const),
    ),
  });

  const resultsArray = results as string[];

  const sickleOwners: Record<string, string> = {};
  for (let i = 0; i < sickleAddresses.length; i++) {
    sickleOwners[sickleAddresses[i]] = resultsArray[i];
  }
  
  return sickleOwners;
};



export const getTimestampAtBlock = async (blockNumber: number) => {
  const block = await client.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};

