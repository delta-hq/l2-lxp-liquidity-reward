import { OutputSchemaRow, Pool, UserPositions } from './types';
import { getAddress, JsonRpcProvider } from 'ethers'
import { getAllLiquidities } from './izumi.js'

type UserBalance = Pick<OutputSchemaRow, 'user_address' | 'token_balance' | 'token_address' | 'token_symbol'>
const ezETHAddress = getAddress('0x8fee71ab3ffd6f8aec8cd2707da20f4da2bf583d')
const ethAddress = getAddress('0x0000000000000000000000000000000000000000')
const wETHAddress = getAddress('0x8280a4e7D5B3B658ec4580d3Bc30f5e50454F169')

const getAllPools = async () => {
  const query = `
    query MyQuery {
      pools(first: 1000) {
        id
        balance
        decimals
        poolName
        symbol
        totalSupplied
        underlying
      }
    }
  `;

  const response = await fetch('https://graph.zklink.io/subgraphs/name/lxp-points', {
    method: 'POST',
    body: JSON.stringify({ query }),
    headers: { 'Content-Type': 'application/json' },
  });

  const { data } = await response.json();
  const { pools } = data

  return pools as Pool[]
}

export const getUserPositionsAtBlock = async (
  blockNumber: number,
): Promise<UserBalance[]> => {
  let result: UserBalance[] = [];
  const pools = await getAllPools()
  const izumiData = await getAllLiquidities(blockNumber) as { address: string, amount: string }[]

  let skip = 0;
  const pageSize = 1000
  let fetchNext = true;
  while (fetchNext) {
    const query = `
      query MyQuery(
        $skip: Int = ${skip},
        $first: Int = ${pageSize},
        $number: Int = ${blockNumber}
      ) {
        userPositions(where: {validate: true}, first: $first, skip: $skip,  block: {number: $number}) {
          id
          balances {
            balance
            id
            token
          }
          positions {
            pool
            id
            supplied
            token
          }
          validate
        }
      }`

    const response = await fetch('https://graph.zklink.io/subgraphs/name/lxp-points-distribution', {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    });

    const { data } = await response.json();
    const { userPositions } = data as UserPositions

    const res = userPositions.map(data => {
      const userAddress = data.id
      const ethBalance = data.balances.reduce((prev, cur) => {
        if ([ethAddress, wETHAddress].includes(getAddress(cur.token))) {
          return prev + BigInt(cur.balance)
        }
        return prev
      }, BigInt(0))

      const poolEthBalance = data.positions.reduce((prev, cur) => {
        if ([ethAddress, wETHAddress].includes(getAddress(cur.token))) {
          const pool = pools.find(pool => pool.id === cur.pool)
          if (!pool) return prev
          return prev + BigInt(cur.supplied) * BigInt(pool.balance) / BigInt(pool.totalSupplied)
        }
        return prev
      }, BigInt(0))

      const ezEthBalance = BigInt((data.balances.find((balance) => ezETHAddress === getAddress(balance.token)))?.balance ?? '0')

      const poolEzEthBalance = data.positions.reduce((prev, cur) => {
        if (ezETHAddress === getAddress(cur.token)) {
          const pool = pools.find(pool => pool.id === cur.pool)
          if (!pool) return prev
          return prev + BigInt(cur.supplied) * BigInt(pool.balance) / BigInt(pool.totalSupplied)
        }
        return prev
      }, BigInt(0))

      return [{
        user_address: userAddress,
        token_address: ethAddress,
        token_balance: (poolEthBalance + ethBalance),
        token_symbol: "ETH"
      },
      {
        user_address: userAddress,
        token_address: ezETHAddress,
        token_balance: (ezEthBalance + poolEzEthBalance),
        token_symbol: "ezETH"
      }].filter(i => i.token_balance > BigInt(0)).map((data) => ({
        ...data,
        token_balance: data.token_balance.toString()
      }))
    })

    result.push(...res.flat())

    if (userPositions.length < pageSize) {
      console.log(`The last data from ${skip} to ${skip + pageSize}`)
      fetchNext = false;
    } else {
      console.log(`The data from ${skip} to ${skip + pageSize}`)
      skip += pageSize
    }
  }

  result = result.map(item => {
    const izumi = izumiData.find(d => d.address === item.user_address)
    if (!izumi) return item
    return { ...item, token_balance: (BigInt((item.token_balance)) + BigInt(izumi.amount)).toString() }
  }).sort((a, b) => Number(a.token_balance) - Number(b.token_balance))
  const totalETH = result.filter(i => i.token_address === ethAddress).reduce((prev, cur) => prev + (Number(cur.token_balance) / 1e18), (0))
  const totalEzETH = result.filter(i => i.token_address === ezETHAddress).reduce((prev, cur) => prev + (Number(cur.token_balance) / 1e18), (0))
  console.log('Total ETH:', totalETH, ' Total ezETH:', totalEzETH);

  return result;
};

export const getTimestampAtBlock = async (blockNumber: number) => {
  const provider = new JsonRpcProvider('https://rpc.zklink.io')
  const block = await provider.getBlock(blockNumber)
  return Number(block?.timestamp);
};
