import axios from "axios"; // Referencing when fetch cannot take effect when using proxies
import BigNumber from "bignumber.js";
import moment from "moment";
import { AMM_TYPES, CHAINS, PROTOCOLS, SUBGRAPH_URLS } from "./config";

export interface Position {
  id: string;
  user: {
    id: string;
  };
  pair: {
    id: string;
    type: string;
    baseReserve: string;
    quoteReserve: string;
    baseToken: {
      id: string;
      decimals: number;
      name: string;
      symbol: string;
      price: string;
    };
    quoteToken: {
      id: string;
      decimals: number;
      name: string;
      symbol: string;
      price: string;
    };
    baseLpToken: {
      id: string;
      decimals: number;
      name: string;
      symbol: string;
      totalSupply: string;
    };
    quoteLpToken: {
      id: string;
      decimals: number;
      name: string;
      symbol: string;
      totalSupply: string;
    };
  };
  lpToken: {
    id: string;
    decimals: number;
    name: string;
    symbol: string;
    totalSupply: string;
  };
  liquidityTokenBalance: string;
  liquidityTokenInMining: string;
  lastTxTime: number;
  updatedAt: number;
}

export interface PositionWithUSDValue extends Position {
  token0USDValue: string;
  token1USDValue: string;
  token0AmountsInWei: bigint;
  token1AmountsInWei: bigint;
  token0DecimalValue: number;
  token1DecimalValue: number;
}

export interface UserTokenBalanceInfo {
  tokenBalance: bigint;
  tokenSymbol: string;
  usdPrice: number;
}

export const getPositionsForAddressByPoolAtBlock = async (
  blockNumber: number,
  address: string,
  poolId: string,
  chainId: CHAINS,
  protocol: PROTOCOLS,
  ammType: AMM_TYPES
): Promise<Position[]> => {
  let subgraphUrl = (SUBGRAPH_URLS as any)[chainId][protocol][ammType];
  let blockQuery = blockNumber !== 0 ? ` ,block: {number: ${blockNumber}}` : ``;

  let where: any = {};
  if (poolId !== "") where["pair"] = poolId.toLowerCase();
  if (address !== "") where["user"] = address.toLowerCase();

  let skip = 0;
  let fetchNext = true;
  let result: Position[] = [];
  while (fetchNext) {
    let query = `query getLps($where: LiquidityPosition_filter) {
        liquidityPositions(orderBy: updatedAt, first:1000,skip:${skip},where: $where ${blockQuery} ) {
            id
            user {
            id
            }
            pair {
                id
                type
                baseReserve
                quoteReserve
                baseToken {
                    id
                    decimals
                    name
                    symbol
                }
                quoteToken {
                    id
                    decimals
                    name
                    symbol
                }
                baseLpToken {
                    id
                    decimals
                    name
                    symbol
                    totalSupply
                }
                quoteLpToken {
                    id
                    decimals
                    name
                    symbol
                    totalSupply
                }
            }
            lpToken {
                id
                decimals
                name
                symbol
                totalSupply
            }
            liquidityTokenBalance
            liquidityTokenInMining
            lastTxTime
            updatedAt
        }
        _meta {
            block {
            number
            }
        }
        }
`;

    // console.log(query)
    // console.log(
    //   JSON.stringify({
    //     query,
    //     variables: {
    //       where,
    //     },
    //     operationName: "getLps",
    //   })
    // );

    let response = await axios.post(
      subgraphUrl,
      {
        query,
        variables: {
          where,
        },
        operationName: "getLps",
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    let data = response.data;
    let positions = data.data.liquidityPositions;
    for (let i = 0; i < positions.length; i++) {
      let position = positions[i];
      let transformedPosition: Position = position;
      result.push(transformedPosition);
    }
    if (positions.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }
  return result;
};

export const getPositionAtBlock = async (
  blockNumber: number,
  positionId: number,
  chainId: CHAINS,
  protocol: PROTOCOLS,
  ammType: AMM_TYPES
): Promise<Position> => {
  let subgraphUrl = (SUBGRAPH_URLS as any)[chainId][protocol][ammType];
  let blockQuery = blockNumber !== 0 ? `, block: {number: ${blockNumber}}` : ``;
  let query = `query getLp($where: LiquidityPosition_filter) {
        liquidityPosition(where: $where ${blockQuery} ) {
            id
            user {
            id
            }
            pair {
            id
            type
            baseToken {
                id
                decimals
                name
                symbol
            }
            quoteToken {
                id
                decimals
                name
                symbol
            }
            }
            lpToken {
            id
            decimals
            name
            symbol
            }
            liquidityTokenBalance
            liquidityTokenInMining
            lastTxTime
            updatedAt
        }
        _meta {
            block {
            number
            }
        }
        }
`;
  let response = await axios.post(
    subgraphUrl,
    { query },
    {
      headers: { "Content-Type": "application/json" },
    }
  );
  let data = response.data;
  let position = data.data.position;

  return position;

  // let tickLow = Number(position.tickLower.tickIdx);
  // let tickHigh = Number(position.tickUpper.tickIdx);
  // let liquidity = BigInt(position.liquidity);
  // let sqrtPriceX96 = BigInt(position.pool.sqrtPrice);
  // let tick = Number(position.pool.tick);
  // let decimal0 = position.token0.decimals;
  // let decimal1 = position.token1.decimals;
  // let token0DerivedUSD = position.token0.derivedUSD;
  // let token1DerivedUSD = position.token1.derivedUSD;
  // let token0AmountsInWei = PositionMath.getToken0Amount(tick, tickLow, tickHigh, sqrtPriceX96, liquidity);
  // let token1AmountsInWei = PositionMath.getToken1Amount(tick, tickLow, tickHigh, sqrtPriceX96, liquidity);

  // let token0DecimalValue = Number(token0AmountsInWei) / 10 ** decimal0;
  // let token1DecimalValue = Number(token1AmountsInWei) / 10 ** decimal1;

  // let token0UsdValue = BigNumber(token0AmountsInWei.toString()).multipliedBy(token0DerivedUSD).div(10 ** decimal0).toFixed(4);
  // let token1UsdValue = BigNumber(token1AmountsInWei.toString()).multipliedBy(token1DerivedUSD).div(10 ** decimal1).toFixed(4);

  // return [position.token0, position.token1,token0AmountsInWei, token1AmountsInWei, token0DecimalValue, token1DecimalValue,token0UsdValue, token1UsdValue,data.data._meta];
};

export const getTokenPriceFromPositions = async (
  positions: Position[],
  chain: string
): Promise<Position[]> => {
  const tokenMap: any = {};
  positions.forEach((position) => {
    const date = moment.unix(Number(position.updatedAt)).format("YYYY-MM-DD");
    const baseTokenKey = chain + "-" + position.pair.baseToken.id + "-" + date;
    tokenMap[baseTokenKey] = {
      network: chain,
      symbol: position.pair.baseToken.symbol,
      date,
      address: position.pair.baseToken.id,
    };

    const quoteTokenKey =
      chain + "-" + position.pair.quoteToken.id + "-" + date;
    tokenMap[quoteTokenKey] = {
      network: chain,
      symbol: position.pair.quoteToken.symbol,
      date,
      address: position.pair.quoteToken.id,
    };
  });
  const tokens = Object.values(tokenMap);
  const tokenPriceMap: any = {};
  for (let i = 0, lg = Math.floor(tokens.length / 1000); i <= lg; i++) {
    const tokenBatch = tokens.slice(i, i + 1000);
    const body: any = {
      networks: [],
      addresses: [],
      symbols: [],
      dates: [],
    };
    tokenBatch.forEach((token: any) => {
      body.networks.push(token.network);
      body.addresses.push(token.address);
      body.symbols.push(token.symbol);
      body.dates.push(token.date);
    });
    const prices = await getTokenUsdPrice(body);
    tokenBatch.forEach((token: any, index: number) => {
      const key = chain + "-" + token.address + "-" + token.date;
      tokenPriceMap[key] = prices[index].price;
    });
  }

  positions.forEach((position) => {
    const date = moment.unix(Number(position.updatedAt)).format("YYYY-MM-DD");
    const baseTokenKey = chain + "-" + position.pair.baseToken.id + "-" + date;
    position.pair.baseToken.price = tokenPriceMap[baseTokenKey] || "0";
    const quoteTokenKey =
      chain + "-" + position.pair.quoteToken.id + "-" + date;
    position.pair.quoteToken.price = tokenPriceMap[quoteTokenKey] || "0";
  });

  return positions;
};

export const getPositionDetailsFromPosition = (
  position: Position
): PositionWithUSDValue => {
  if (position.pair.type !== "CLASSICAL") {
    const totalSupply = new BigNumber(position.lpToken.totalSupply).div(
      10 ** Number(position.lpToken.decimals)
    );
    const baseTokenRatio = totalSupply.eq(0)
      ? new BigNumber(0)
      : new BigNumber(position.pair.baseReserve).div(totalSupply);
    const quoteTokenRatio = totalSupply.eq(0)
      ? new BigNumber(0)
      : new BigNumber(position.pair.quoteReserve).div(totalSupply);
    const baseTokenAmount = new BigNumber(position.liquidityTokenBalance).times(
      baseTokenRatio
    );
    const quoteTokenAmount = new BigNumber(
      position.liquidityTokenBalance
    ).times(quoteTokenRatio);
    const token0UsdValue = baseTokenAmount.times(position.pair.baseToken.price);
    const token1UsdValue = quoteTokenAmount.times(
      position.pair.quoteToken.price
    );
    let token0AmountsInWei = baseTokenAmount
      .times(10 ** Number(position.pair.baseToken.decimals))
      .toFixed(0);
    if (token0AmountsInWei === "NaN") {
      token0AmountsInWei = "0";
    }
    let token1AmountsInWei = quoteTokenAmount
      .times(10 ** Number(position.pair.quoteToken.decimals))
      .toFixed(0);
    if (token1AmountsInWei === "NaN") {
      token1AmountsInWei = "0";
    }
    return {
      ...position,
      token0USDValue: token0UsdValue.toString(),
      token1USDValue: token1UsdValue.toString(),
      token0AmountsInWei: BigInt(token0AmountsInWei),
      token1AmountsInWei: BigInt(token1AmountsInWei),
      token0DecimalValue: baseTokenAmount.toNumber(),
      token1DecimalValue: quoteTokenAmount.toNumber(),
    };
  }
  return {
    ...position,
    token0USDValue: "0",
    token1USDValue: "0",
    token0AmountsInWei: 0n,
    token1AmountsInWei: 0n,
    token0DecimalValue: 0,
    token1DecimalValue: 0,
  };
};

export const getLPValueByUserAndPoolFromPositions = async (
  positions: Position[]
): Promise<Map<string, Map<string, UserTokenBalanceInfo>>> => {
  let result = new Map<string, Map<string, UserTokenBalanceInfo>>();
  for (let i = 0; i < positions.length; i++) {
    let position = positions[i];

    let positionWithUSDValue = await getPositionDetailsFromPosition(position);
    if (positionWithUSDValue.token0DecimalValue == 0 || positionWithUSDValue.token1DecimalValue == 0) {
      continue
    }

    let tokenXAddress = position.pair.baseToken.id;
    let tokenYAddress = position.pair.quoteToken.id;
    let owner = position.user.id;
    if (owner == '0x0000000000000000000000000000000000000000') continue;

    let userPositions = result.get(owner);
    if (userPositions === undefined) {
      userPositions = new Map<string, UserTokenBalanceInfo>();
      result.set(owner, userPositions);
    }

    let tokenXAmount = userPositions.get(tokenXAddress);
    if (tokenXAmount === undefined) {
      tokenXAmount = { tokenBalance: BigInt(0), tokenSymbol: position.pair.baseToken.symbol, usdPrice: 0 };
    }

    let tokenYAmount = userPositions.get(tokenYAddress);
    if (tokenYAmount === undefined) {
      tokenYAmount = { tokenBalance: BigInt(0), tokenSymbol: position.pair.quoteToken.symbol, usdPrice: 0 };
    }

    tokenXAmount.tokenBalance = tokenXAmount.tokenBalance + positionWithUSDValue.token0AmountsInWei;
    tokenYAmount.tokenBalance = tokenYAmount.tokenBalance + positionWithUSDValue.token1AmountsInWei;

    userPositions.set(tokenXAddress, tokenXAmount);
    userPositions.set(tokenYAddress, tokenYAmount);
  }
  return result;
};

export interface TokenPriceQueryData {
  networks: string[];
  addresses: string[];
  symbols: string[];
  dates: string[];
  isCache?: boolean;
}
export interface TokenPriceResultList {
  address: string;
  network: string;
  price: string;
  serial: number;
  symbol: string;
}
export async function getTokenUsdPrice(
  list: TokenPriceQueryData
): Promise<TokenPriceResultList[]> {
  let count = 0;
  do {
    try {
      let response = await axios.post(
        "https://api.dodoex.io/frontend-price-api/historical/batch",
        list,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      let data = response.data;
      if (data.data) return data.data;
    } catch (err) {
      console.error("getTokenUsdPrice err:", err, JSON.stringify(list));
    }
  } while (count < 3);
  return [];
}
