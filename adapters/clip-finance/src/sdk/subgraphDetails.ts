import { createPublicClient, extractChain, http } from "viem";
import { linea } from "viem/chains";
import { SUBGRAPH_URLS, CHAINS, RPC_URLS, RESERVE_SUBGRAPH_URLS } from "./config";
import Big from "big.js";

export interface UserBalanceSnapshot {
  id: string;
  balance: Big;
  token  : string;
  tokenSymbol: string;
}

export interface User {
  id: string;
  balance: Big;
  token  : string;
  tokenSymbol: string;
}

interface SharePricesSnapshot {
  id: string;
  price0: Big;
  price01: Big;
  price1: Big;
  price10: Big;
  token0: string;
  token0Symbol: string;
  token1      : string;
  token1Symbol: string;
}

interface UserSharesSnapshot {
  id: string;
  shares0: Big;
  shares1: Big;
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

export const getUserBalanceSnapshotAtBlock = async (
  blockNumber: number,
  address: string
): Promise<UserBalanceSnapshot[]> => {
  let subgraphUrl = SUBGRAPH_URLS[CHAINS.LINEA];
  let blockQuery = blockNumber !== 0 ? ` block: {number: ${blockNumber}}` : ``;

  let idQuery = address !== "" ? `id: "${address.toLowerCase()}"` : ``;
  let showZeroBalances = false;
  let balanceNotZeroQuery = showZeroBalances ? "" : `balance_gt: 0`;
  let whereQueries = [idQuery, balanceNotZeroQuery];
  
  let skip = 0;
  let fetchNext = true;
  let result: UserBalanceSnapshot[] = [];
  const sharePricesMap = new Map<string, SharePricesSnapshot>();
  while (fetchNext) {
    const query = `{
            sharePrices(
                ${blockQuery}
                first:1000, skip:${skip}
            ){
              id
              price0
              price01
              price1
              price10
              token0
              token0Symbol
              token1
              token1Symbol
            }
          }
          `;
    let count = 0;
    let response;
    do {    
      response = await fetch(subgraphUrl, {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
      });
      if (response.status != 200) {
        subgraphUrl = RESERVE_SUBGRAPH_URLS[CHAINS.LINEA];
        response = await fetch(subgraphUrl, {
          method: "POST",
          body: JSON.stringify({ query }),
          headers: { "Content-Type": "application/json" },
        });
      }
      if (response.status != 200) {
          console.log("sharePrices fetching failed. Try again in 15 sec");
          await delay(15000);
      }
      ++count
    } while ((response.status != 200) && (count < 10))
    
    let data = await response.json();
    let snapshots = data.data.sharePrices;
    for (const snapshot of snapshots) {
      const sharePriceSnapshot: SharePricesSnapshot = {
        id: snapshot.id,
        price0: Big(snapshot.price0),
        price01: Big(snapshot.price01),
        price1 : Big(snapshot.price1),
        price10: Big(snapshot.price10),
        token0 : snapshot.token0,
        token0Symbol: snapshot.token0Symbol,
        token1      : snapshot.token1,
        token1Symbol: snapshot.token1Symbol,
      }
      sharePricesMap.set(snapshot.id, sharePriceSnapshot);
    } 
    if (snapshots.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }

  skip = 0;
  fetchNext = true;
  const balanceMap = new Map<string, UserBalanceSnapshot>();
  const strategyRouterSharesMap = new Map<string, UserSharesSnapshot>();
  let strategyRouterBalance = new Map<string, UserBalanceSnapshot>();
  const addBalance = (balance: UserBalanceSnapshot, share: UserBalanceSnapshot) => {
    const user= share.id.substring(0, 42);
    const key = user.concat(balance.token);
    if (user == "0xa663f143055254a503467ff8b18aa9e70b9455b6") {
      strategyRouterBalance.set(key.concat(balance.token), balance);
    } else if (balance.balance.gt(0)) {
      if (!balanceMap.has(key)) {
        balanceMap.set(key, balance);
      } else {
          const oldUserBalanceSnapshot = balanceMap.get(key);
          if (oldUserBalanceSnapshot) {
            oldUserBalanceSnapshot.balance = oldUserBalanceSnapshot.balance.plus(balance.balance);
            balanceMap.set(key, oldUserBalanceSnapshot);
          }  
        }
      }
    };
  
  while (fetchNext) {
    const query = `{
            userShares(
                ${blockQuery}
                first:1000, skip:${skip}
            ){
              id
              shares0
              shares1
            }
          }
          `;
    let count = 0;
    let response;
    do {    
      response = await fetch(subgraphUrl, {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
      });
      if (response.status != 200) {
        await delay(15000);
        console.log("userShares fetching failed. Try again in 15 sec");
      }
      ++count;
    } while ((count < 10) && (response.status != 200)) {

    }
    let data = await response.json();
    let snapshots = data.data.userShares;
    for (const snapshot of snapshots) {
      const contract = "0x".concat(snapshot.id.substring(42));  
      const sharePrice = sharePricesMap.get(contract);
      const user       = snapshot.id.substring(0, 42);
      if (sharePrice) {
        let userBalanceSnapshot: UserBalanceSnapshot = {
          id: "",
          balance: Big(0),
          token  : "",
          tokenSymbol: "",
          
        };
        if (sharePrice.price0.gt(0)) {
          userBalanceSnapshot = {
            id: user.toLowerCase(),
            balance: Big(Math.round(Big(snapshot.shares0).mul(sharePrice.price0).div(1e18).toNumber())),
            token  : sharePrice.token0.toLowerCase(),
            tokenSymbol: sharePrice.token0Symbol,
            
          }
          addBalance(userBalanceSnapshot, snapshot);
        }
        if (sharePrice.price01.gt(0))  {
          userBalanceSnapshot = {
            id: user.toLowerCase(),
            balance: Big(Math.round(Big(snapshot.shares0).mul(sharePrice.price01).div(1e18).toNumber())),
            token  : sharePrice.token1.toLowerCase(),
            tokenSymbol: sharePrice.token1Symbol,
            
          }
          addBalance(userBalanceSnapshot, snapshot);
        }
        if (sharePrice.price1.gt(0))  {
          userBalanceSnapshot = {
            id: user.toLowerCase(),
            balance: Big(Math.round(Big(snapshot.shares1).mul(sharePrice.price1).div(1e18).toNumber())),
            token  : sharePrice.token1.toLowerCase(),
            tokenSymbol: sharePrice.token1Symbol,    
          }
          addBalance(userBalanceSnapshot, snapshot);
        }
        if (sharePrice.price10.gt(0))  {
          userBalanceSnapshot = {
            id: user.toLowerCase(),
            balance: Big(Math.round(Big(snapshot.shares1).mul(sharePrice.price10).div(1e18).toNumber())),
            token  : sharePrice.token0.toLowerCase(),
            tokenSymbol: sharePrice.token0Symbol,
            
          }
          addBalance(userBalanceSnapshot, snapshot);
        } 
      } else {
        if (Big(snapshot.shares0).gt(0)) {
          strategyRouterSharesMap.set(snapshot.id, snapshot);
        }
      }
    } 
    if (snapshots.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }

  const query = `{
    sharesTokenSharesCounts (
      ${blockQuery}
    ){
      id
      total
    }
  }
  `;

  let count = 0;
  let response;
  do {
    response = await fetch(subgraphUrl, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
      });
    if (response.status != 200) {
      console.log("sharesTokenSharesCounts fetching failed. Try again in 15 sec");
      await delay(15000)
    }
    ++count;
  } while ((count < 10) && (response.status != 200));
  let data = await response.json();
  let snapshots = data.data.sharesTokenSharesCounts;
  let strategyRouterTotalShares: Big = Big(0);
  for (const snapshot of snapshots) {
    strategyRouterTotalShares = Big(snapshot.total);
  }
  let countedTotalShares: Big = Big(0);
  if (strategyRouterTotalShares.gt(0)) {
    let checkBalance = Big(0);
    strategyRouterSharesMap.forEach((share: UserSharesSnapshot, id: string)=> {
      const user = share.id.substring(0, 42);      
      for (const srbKey of strategyRouterBalance.keys()) {
        const balance = strategyRouterBalance.get(srbKey);
        if (balance) {
          countedTotalShares = countedTotalShares.plus(Big(share.shares0));
          const userBalance : UserBalanceSnapshot = {
            id: user.toLowerCase(),
            balance: Big(Math.round(Big(share.shares0).mul(balance.balance).div(strategyRouterTotalShares).toNumber())),
            token  : balance.token.toLowerCase(),
            tokenSymbol: balance.tokenSymbol
          }
         
          checkBalance = checkBalance.plus(userBalance.balance);
          const key = user.concat(balance.token);
          if (!balanceMap.has(key)) {
            balanceMap.set(key, userBalance);
          } else {
            const oldUserBalance = balanceMap.get(key);
            if (oldUserBalance) {
              oldUserBalance.balance = oldUserBalance.balance.plus(userBalance.balance);
              balanceMap.set(key, userBalance);
            }
          }
        }
      }
    });
  }
  
  return Array.from(balanceMap.values());
};

export const getTimestampAtBlock = async (blockNumber: number) => {
  const publicClient = createPublicClient({
    chain: extractChain({ chains: [linea], id: linea.id }),
    transport: http(RPC_URLS[CHAINS.LINEA], {
      retryCount: 5,
      timeout: 60_000,
    }),
  });

  const block = await publicClient.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};