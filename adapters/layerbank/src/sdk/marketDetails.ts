import { createPublicClient, extractChain, http, getContract } from "viem";
import { CHAINS, RPC_URLS } from "./config";
import { linea } from "viem/chains";
import coreAbi from "./abi/core.abi";
import ltokenAbi from "./abi/ltoken.abi";
import { AccountState } from "./subgraphDetails";

export interface MarketInfo {
  address: string;
  underlyingAddress: string;
  underlyingSymbol: string;
  exchangeRateStored: bigint;
}

export const getMarketInfos = async (
  coreAddress: `0x${string}`,
  blockNumber?: bigint
) => {
  const publicClient = createPublicClient({
    chain: extractChain({ chains: [linea], id: CHAINS.LINEA }),
    transport: http(RPC_URLS[CHAINS.LINEA]),
  });

  const core = getContract({
    address: coreAddress,
    abi: coreAbi,
    client: publicClient,
  });

  const marketAddresses = await core.read.allMarkets();
  const markets = marketAddresses.map((m) =>
    getContract({
      address: m,
      abi: ltokenAbi,
      client: publicClient,
    })
  );

  const underlyingResults = await publicClient.multicall({
    contracts: markets.map((m) => ({
      address: m.address,
      abi: m.abi,
      functionName: "underlying",
    })) as any,
  });

  const underlyingAddresses = underlyingResults
    .map((v) => v.result as `0x${string}`)
    .map((m) => {
      if (m === "0x0000000000000000000000000000000000000000") {
        return "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f";
      } else {
        return m.toLowerCase();
      }
    });

  const underlyings = underlyingAddresses.map((m) => {
    getContract({
      address: m as `0x${string}`,
      abi: ltokenAbi,
      client: publicClient,
    });
  });

  const underlyingSymbolResults = await publicClient.multicall({
    contracts: underlyings.map((m) => ({
      address: (m as any).address,
      abi: (m as any).abi,
      functionName: "symbol",
    })) as any,
  });

  const exchangeRateResults = await publicClient.multicall({
    contracts: markets.map((m) => ({
      address: m.address,
      abi: m.abi,
      functionName: "exchangeRate",
    })) as any,
    blockNumber,
  });

  const marketInfos: MarketInfo[] = [];

  for (let i = 0; i < markets.length; i++) {
    const marketAddress = markets[i].address.toLowerCase();
    const underlyingAddress = underlyingAddresses[i];

    marketInfos.push({
      address: marketAddress,
      underlyingAddress,
      underlyingSymbol: underlyingSymbolResults[i].result as any,
      exchangeRateStored: BigInt(
        exchangeRateResults[i].status === "success"
          ? (exchangeRateResults[i].result as any)
          : 0
      ),
    });
  }

  return marketInfos;
};

export const updateBorrowBalances = async (
  states: AccountState[],
  blockNumber?: bigint
) => {
  const marketInfos = await getMarketInfos(
    "0x43Eac5BFEa14531B8DE0B334E123eA98325de866"
  );
  const marketsByUnderlying: any = {};
  for (let marketInfo of marketInfos) {
    marketsByUnderlying[marketInfo.underlyingAddress] = marketInfo.address;
  }

  const publicClient = createPublicClient({
    chain: extractChain({ chains: [linea], id: CHAINS.LINEA }),
    transport: http(RPC_URLS[CHAINS.LINEA]),
  });

  states = states.filter((x) => x.borrowAmount > 0);

  console.log(`Will update all borrow balances for ${states.length} states`);
  for (var i = 0; i < states.length; i += 500) {
    const start = i;
    const end = i + 500;
    var subStates = states.slice(start, end);
    console.log(`Updating borrow balances for ${start} - ${end}`);

    const borrowBalanceResults = await publicClient.multicall({
      contracts: subStates
        .map((m) => [
          {
            address: marketsByUnderlying[m.token],
            abi: ltokenAbi,
            functionName: "borrowBalanceOf",
            args: [m.account],
          },
        ])
        .flat() as any,
      blockNumber,
    });

    for (var j = 0; j < subStates.length; j++) {
      subStates[j].borrowAmount = BigInt(
        borrowBalanceResults[j].result?.toString() ?? 0
      );
    }
  }
};
