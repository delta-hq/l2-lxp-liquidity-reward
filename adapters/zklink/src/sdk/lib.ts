import { JsonRpcProvider } from 'ethers'
import { getUserTVLData as getUserTVLDataInAgx } from '../protocols/agx'
import { getUserTVLData as getUserTVLDataInInterport } from '../protocols/interport'
import { getUserTVLData as getUserBalanceInIzumi } from '../protocols/izumi'
import { getUserTVLData as getUserTVLDataInLayerbank } from '../protocols/layerbank'
import { getUserTVLData as getUserTVLDataInLinkswap } from '../protocols/linkswap'
import { getUserTVLData as getUserTVLDataInNative } from '../protocols/native'
import { getUserTVLData as getUserTVLDataInNovaswap } from '../protocols/novaswap'
import { getUserTVLData as getUserTVLDataInShoebill } from '../protocols/shoebill'
import { getUserTVLData as getUserTVLDataInWagmi } from '../protocols/wagmi'
import { getUserTVLData as getUserTVLDataInZkdx } from '../protocols/zkdx'
import type { UserPosition, LPMap, UserBalance } from './types'


const addresses = [
  {
    zklinkAddress: '0x0000000000000000000000000000000000000000', // ETH
    lineaAddress: '0x0000000000000000000000000000000000000000'
  },
  {
    zklinkAddress: '0x000000000000000000000000000000000000800A', // ETH
    lineaAddress: '0x0000000000000000000000000000000000000000'
  },
  {
    zklinkAddress: '0x8280a4e7D5B3B658ec4580d3Bc30f5e50454F169', // WETH
    lineaAddress: '0x0000000000000000000000000000000000000000'
  },
  {
    zklinkAddress: '0x8fee71ab3ffd6f8aec8cd2707da20f4da2bf583d', // ezETH
    lineaAddress: '0x2416092f143378750bb29b79eD961ab195CcEea5'
  },
  // {
  //   zklinkAddress: '0xAF5852CA4Fc29264226Ed0c396dE30C945589D6D', // USDT
  //   lineaAddress: '0xA219439258ca9da29E9Cc4cE5596924745e12B93'
  // },
  // {
  //   zklinkAddress: '0xfFE944D301BB97b1271f78c7d0E8C930b75DC51B', // USDC
  //   lineaAddress: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff'
  // }
]

const tokenWhiteList = addresses.map(i => i.zklinkAddress.toLowerCase())

const addressMap = new Map(addresses.map(item => [item.zklinkAddress.toLowerCase(), item.lineaAddress]))

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type QueryFunction<T> = (skip: number, pageSize: number) => Promise<T>;

const fetchInParallel = async (
  queryFunction: QueryFunction<UserPosition['userPositions']>,
  pageSize: number,
  maxConcurrency: number
): Promise<UserPosition['userPositions']> => {
  let result: UserPosition['userPositions'] = [];
  const promises: Array<Promise<void>> = [];
  let processedRecords = 0;

  const fetchPage = async (startSkip: number) => {
    let localSkip = startSkip;
    let fetchNext = true;

    while (fetchNext) {
      const data = await queryFunction(localSkip, pageSize);
      result = result.concat(data);
      processedRecords += data.length;
      console.log(`Processed ${processedRecords} records so far`);

      if (data.length < pageSize) {
        fetchNext = false;
      } else {
        localSkip += pageSize * maxConcurrency;
      }
    }
  };

  for (let i = 0; i < maxConcurrency; i++) {
    promises.push(fetchPage(i * pageSize));
  }

  await Promise.all(promises);

  console.log(`Total processed records: ${processedRecords}`);
  return result;
};

const fetchGraphQLData = async <T>(subgraphUrl: string, query: string): Promise<T> => {
  let response;
  let data;
  let retry = true;
  let retryCount = 0;
  const maxRetries = 5;

  while (retry && retryCount < maxRetries) {
    try {
      response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        retryCount++;
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      data = await response.json();
      if (data.errors) {
        retryCount++;
        throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
      }

      retry = false;
    } catch (error) {
      console.error('Fetch error:', error);
      console.log('Retrying in 5 seconds...');
      await delay(10000);
      retryCount++;
    }
  }

  if (retryCount >= maxRetries) {
    console.error("Maximum retry limit reached");
  }

  return data;
};

const getUserBalance = async (blockNumber: number, tokenWhiteList: string[]) => {
  const pageSize = 1000;
  const maxConcurrency = 10;

  const queryFunction: QueryFunction<UserPosition["userPositions"]> = async (skip, pageSize) => {
    const query = `
      query MyQuery(
        $first: Int = ${pageSize},
        $skip: Int = ${skip}, 
        $number: Int = ${blockNumber}, 
        $token_in: [Bytes!] = ${JSON.stringify(tokenWhiteList)},
        ) {
        userPositions(first: $first, skip: $skip, block: {number: $number}) {
          id
          balances(where: {token_in: $token_in}) {
            balance
            token
          }
        }
      }
    `;
    console.log(`The data from ${skip} to ${skip + pageSize}`)
    const { data } = await fetchGraphQLData<{ data: UserPosition }>('https://graph.zklink.io/subgraphs/name/lxp-points', query);
    const result = data.userPositions
    return result
  };

  const result = await fetchInParallel(queryFunction, pageSize, maxConcurrency);

  return result
    .map(item => {
      const userAddress = item.id;
      return item.balances.map(position => ({
        balance: BigInt(position.balance),
        tokenAddress: position.token,
        userAddress: userAddress
      }))
    })
    .flat()
    .filter(i => tokenWhiteList.includes(i.tokenAddress.toLowerCase()))
    .map(i => ({
      balance: i.balance,
      tokenAddress: addressMap.get(i.tokenAddress.toLowerCase())?.toLowerCase()!,
      userAddress: i.userAddress.toLowerCase(),
    }))
};

const getLPInfo = async (blockNumber: number): Promise<{ lpMap: LPMap, poolAddress: string[] }> => {
  const result = (await Promise.all([
    getUserTVLDataInAgx(blockNumber),
    getUserTVLDataInInterport(blockNumber),
    getUserBalanceInIzumi(blockNumber),
    getUserTVLDataInLayerbank(blockNumber),
    getUserTVLDataInLinkswap(blockNumber),
    getUserTVLDataInNative(blockNumber),
    getUserTVLDataInNovaswap(blockNumber),
    getUserTVLDataInShoebill(blockNumber),
    getUserTVLDataInWagmi(blockNumber),
    getUserTVLDataInZkdx(blockNumber),
  ])).flat() as UserBalance[]

  const filteredData = result
    .filter(i => i.balance > 0n && tokenWhiteList.includes(i.tokenAddress.toLowerCase()))
    .map(item => ({
      ...item,
      tokenAddress: addressMap.get(item.tokenAddress.toLowerCase())!
    }));

  const lpMap = filteredData.reduce((result, item) => {
    const key = item.userAddress.toLowerCase() + item.tokenAddress.toLowerCase()
    const resultItem = result.get(key)
    if (resultItem) {
      resultItem.balance = resultItem.balance + item.balance
    } else {
      result.set(key, {
        tokenAddress: item.tokenAddress.toLowerCase(),
        userAddress: item.userAddress.toLowerCase(),
        balance: item.balance
      })
    }
    return result
  }, new Map())
  const poolAddress = [...new Set(filteredData.map(i => i.poolAddress.toLowerCase()))]
  return { lpMap, poolAddress }
}

export const getUserBalanceSnapshotAtBlock = async (lineaBlockNumber: number) => {
  const blockNumber = Number(await mapLineaBlockToNovaBlock(lineaBlockNumber))
  const [userBalancePosition, lpInfo] = await Promise.all(
    [
      getUserBalance(blockNumber, tokenWhiteList),
      getLPInfo(blockNumber)
    ])

  const userTokenPositionMap = userBalancePosition.reduce((map, item) => {
    if (!lpInfo.poolAddress.includes(item.userAddress.toLowerCase())) {
      const key = item.userAddress.toLowerCase() + item.tokenAddress.toLowerCase()
      const existItem = map.get(key)
      if (existItem) {
        existItem.balance += item.balance
      } else {
        map.set(key, item)
      }
    }
    return map
  }, new Map<string, { balance: bigint; tokenAddress: string; userAddress: string; }>())


  lpInfo.lpMap.forEach((val, key) => {
    const balancePosition = userTokenPositionMap.get(key)
    if (balancePosition) {
      balancePosition.balance = balancePosition.balance + val.balance
    } else {
      userTokenPositionMap.set(key, val)
    }
  })
  return userTokenPositionMap.values()
}

export const mapLineaBlockToNovaBlock = async (blockNumber: number) => {
  const provider = new JsonRpcProvider('https://rpc.linea.build')
  const block = await provider.getBlock(blockNumber)
  const query = `query BlockInfo($timestamp_lte: BigInt = ${block?.timestamp}) {
    blocks(
      where: {timestamp_lte: $timestamp_lte}
      first: 1
      orderBy: timestamp
      orderDirection: desc
    ) {
      number
      timestamp
    }
  }
`
  const { data } = await fetchGraphQLData<{ data: { blocks: { number: string }[] } }>('https://graph.zklink.io/subgraphs/name/nova-blocks', query)
  return data.blocks[0].number
};
