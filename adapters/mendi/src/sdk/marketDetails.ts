import { createPublicClient, extractChain, http, getContract } from "viem";
import { CHAINS, RPC_URLS } from "./config";
import { linea } from "viem/chains";
import comptrollerAbi from "./abi/comptroller.abi";
import ctokenAbi from "./abi/ctoken.abi";

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

  const marketInfos = new Map<string, MarketInfo>();
  for (let i = 0; i < markets.length; i++) {
    const marketAddress = markets[i].address.toLowerCase();

    var marketInfo = marketInfos.get(marketAddress);
    if (marketInfo === undefined) {
      marketInfo = {} as MarketInfo;
      marketInfos.set(marketAddress, marketInfo);
    }

    marketInfo.underlyingAddress = underlyingResults[i].result as any;
    marketInfo.exchangeRateStored = BigInt(
      exchangeRateResults[i].status == "success"
        ? (exchangeRateResults[i].result as any)
        : 0
    );

    marketInfo.underlyingSymbol = underlyingSymbolResults[i].result as any;
  }

  return marketInfos;
};
