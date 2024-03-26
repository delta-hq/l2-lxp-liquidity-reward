import BigNumber from "bignumber.js";

export type TokenLiquidityInfo = {
    amount: number;
    decimals: number;
};
  
export type LiquidityMap = {
    [token: string]: TokenLiquidityInfo;
};
  
export type LiquidityInfo = {
    [user_address: string]: LiquidityMap;
};

export function getOrCreateTokenLiquidityInfo(
    liquidityInfo: LiquidityInfo,
    userAddress: string,
    token: string,
    decimals: number,
  ): TokenLiquidityInfo {
    // Check if the user exists
    if (!liquidityInfo[userAddress]) {
      liquidityInfo[userAddress] = {}; // Create a new entry for the user
    }
  
    // Check if the token exists for the user
    if (!liquidityInfo[userAddress][token]) {
      liquidityInfo[userAddress][token] = {amount:0, decimals: decimals}; // Create a default entry for the token
    }
  
    // Return the liquidity info for the token of the user
    return liquidityInfo[userAddress][token];
}
  
export function combineLiquidityInfoMaps(
    map1: LiquidityInfo,
    map2: LiquidityInfo
  ): LiquidityInfo {
    const combinedMap: LiquidityInfo = {};
  
    // Helper function to add or update liquidity info in the combined map
    const addOrUpdateLiquidityInfo = (userAddress: string, token: string, liquidityInfo: TokenLiquidityInfo) => {

      if (!combinedMap[userAddress]) {
        combinedMap[userAddress] = {};
      }

      if (!combinedMap[userAddress][token]) {
        combinedMap[userAddress][token] = { amount: 0, decimals: liquidityInfo.decimals};
      } else if (combinedMap[userAddress][token].decimals != liquidityInfo.decimals){
        throw new Error(`Token precision doesn't match. user: ${userAddress} token: ${token}`);
      }
      
      const existingAmount = new BigNumber(combinedMap[userAddress][token].amount);
      const newAmount = existingAmount.plus(liquidityInfo.amount);
      combinedMap[userAddress][token].amount = newAmount.toNumber();
  
    };
  
    // Combine map1 into the combinedMap
    for (const userAddress in map1) {
      for (const token in map1[userAddress]) {
        addOrUpdateLiquidityInfo(userAddress, token, map1[userAddress][token]);
      }
    }
  
    // Combine map2 into the combinedMap, adding to existing entries
    for (const userAddress in map2) {
      for (const token in map2[userAddress]) {
        addOrUpdateLiquidityInfo(userAddress, token, map2[userAddress][token]);
      }
    }
  
    return combinedMap;
  }