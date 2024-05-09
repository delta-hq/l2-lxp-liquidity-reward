import { createPublicClient, extractChain, http, getContract } from "viem";
import { CHAINS, RPC_URLS } from "./config";
import { linea } from "viem/chains";
import comptrollerAbi from "./abi/comptroller.abi";
import ctokenAbi from "./abi/ctoken.abi";
import { AccountState } from "./subgraphDetails";

export interface MarketInfo {
  address: string;
  underlyingAddress: string;
  underlyingSymbol: string;
  exchangeRateStored: bigint;
}

export const getMarketInfos = async (
  comptrollerAddress: `0x${string}`,
  blockNumber?: bigint
) => {
  const publicClient = createPublicClient({
    chain: extractChain({ chains: [linea], id: CHAINS.LINEA }),
    transport: http(RPC_URLS[CHAINS.LINEA]),
  });

  const comptroller = getContract({
    address: comptrollerAddress,
    abi: comptrollerAbi,
    client: publicClient,
  });

  const marketAddresses = await comptroller.read.getAllMarkets();
  const markets = marketAddresses.map((m) =>
    getContract({
      address: m,
      abi: ctokenAbi,
      client: publicClient,
    })
  );

  const underlyingResults = await publicClient.multicall({
    contracts: markets
      .map((m) => [
        {
          address: m.address,
          abi: m.abi,
          functionName: "underlying",
        },
      ])
      .flat() as any,
  });
  const underlyingAddresses = underlyingResults.map(
    (v) => v.result as `0x${string}`
  );
  const underlyings = underlyingAddresses.map((m) =>
    getContract({
      address: m,
      abi: ctokenAbi,
      client: publicClient,
    })
  );
  const underlyingSymbolResults = await publicClient.multicall({
    contracts: underlyings.map((m) => ({
      address: m.address,
      abi: m.abi,
      functionName: "symbol",
    })) as any,
  });

  const exchangeRateResults = await publicClient.multicall({
    contracts: markets
      .map((m) => [
        {
          address: m.address,
          abi: m.abi,
          functionName: "exchangeRateStored",
        },
      ])
      .flat() as any,
    blockNumber,
  });

  const marketInfos: MarketInfo[] = [];
  for (let i = 0; i < markets.length; i++) {
    const marketAddress = markets[i].address.toLowerCase();

    marketInfos.push({
      address: marketAddress,
      underlyingAddress: (underlyingResults[i].result as any)?.toLowerCase(),
      underlyingSymbol: underlyingSymbolResults[i].result as any,
      exchangeRateStored: BigInt(
        exchangeRateResults[i].status == "success"
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
    "0x1b4d3b0421ddc1eb216d230bc01527422fb93103"
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
            abi: ctokenAbi,
            functionName: "borrowBalanceStored",
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
