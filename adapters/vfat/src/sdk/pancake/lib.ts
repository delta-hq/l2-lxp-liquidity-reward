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

export const getSickles = async (blockNumber: number) => {
  const query = `query fetchSickles {
        sickleAddresses(block: { number: ${blockNumber} }) {
            sickle
        }
    }`;

  try {
    const response = await fetch(VFAT_SUBGRAPH_URL, {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    });
    const rawBody = await response.text();
    try {
      const { data } = JSON.parse(rawBody);
      return (data as { sickleAddresses: { sickle: `0x${string}` }[] }).sickleAddresses;
    } catch (jsonError) {
      console.error(`JSON parsing error for block ${blockNumber}:`, jsonError);
      console.error('Raw response body:', rawBody); // Log raw body
      throw jsonError;
    }
  } catch (error) {
    // Log network or other fetch errors
    console.error(`Error fetching data for block ${blockNumber}:`, error);
    throw error;
  }
};



export const getOwnerFromMasterChef = async (
  pids: string[],
  blockNumber: bigint,
): Promise<string[]> => {
  const abi = [
    {
      inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      name: 'userPositionInfos',
      outputs: [
        { internalType: 'uint128', name: 'liquidity', type: 'uint128' },
        { internalType: 'uint128', name: 'boostLiquidity', type: 'uint128' },
        { internalType: 'int24', name: 'tickLower', type: 'int24' },
        { internalType: 'int24', name: 'tickUpper', type: 'int24' },
        { internalType: 'uint256', name: 'rewardGrowthInside', type: 'uint256' },
        { internalType: 'uint256', name: 'reward', type: 'uint256' },
        { internalType: 'address', name: 'user', type: 'address' },
        { internalType: 'uint256', name: 'pid', type: 'uint256' },
        { internalType: 'uint256', name: 'boostMultiplier', type: 'uint256' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  const calls = pids.map((pid) => ({
    address: masterChefAddress,
    name: 'userPositionInfos',
    params: [BigInt(pid)],
  }));

  const results = await batchMulticall(abi, calls, blockNumber, 300, 2000);

  return results.map((r) => (r as any)[6] as string);
};


export const getSickleOwners = async (
  sickleAddresses: `0x${string}`[],
  blockNumber: bigint,
): Promise<Record<string, string>> => {
  const abi: Abi = [
    {
      inputs: [],
      name: 'owner',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  const calls = sickleAddresses.map((sickle) => ({
    address: sickle,
    name: 'owner',
    params: [],
  }));

  const results = await batchMulticall(abi, calls, blockNumber, 300, 2000);

  const sickleOwners: Record<string, string> = {};
  for (let i = 0; i < sickleAddresses.length; i++) {
    sickleOwners[sickleAddresses[i]] = results[i] as string;
  }

  return sickleOwners;
};



export const getTimestampAtBlock = async (blockNumber: number) => {
  const block = await client.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};

async function batchMulticall(
  abi: Abi,
  calls: any[],
  blockNumber: bigint,
  batchSize: number,
  delay: number,
) {
  const results = [];
  for (let i = 0; i < calls.length; i += batchSize) {
    const batch = calls.slice(i, i + batchSize);
    const res = await client.multicall({
      allowFailure: false,
      blockNumber,
      contracts: batch.map((call) => ({
        abi,
        address: call.address,
        functionName: call.name,
        args: call.params,
      })),
    });
    results.push(...res);

    if (i + batchSize < calls.length) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return results;
}