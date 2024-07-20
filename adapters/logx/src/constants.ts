import fetch from 'node-fetch';

const Chain_id = 59144;
const underlyingToken = 'BTC';
const collateralToken = 'USDC';
const API_URL = `https://backend-lp.logx.trade/self_pool_data?chainId=${Chain_id}&indexToken=${underlyingToken}&collateralToken=${collateralToken}`;

const bigNumberify = (value: string): bigint => {
  return BigInt(value);
};

export const getLlpPrice = async (): Promise<number> => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const poolValue = data.poolValue;
    const totalSupply = data.totalSupply;

    if (BigInt(totalSupply) === BigInt(0)) {
      return 1;
    }

    if (poolValue && totalSupply) {
      const poolValueBigInt = bigNumberify(poolValue);
      const totalSupplyBigInt = bigNumberify(totalSupply);
      const poolValueAdjusted = poolValueBigInt / BigInt(10 ** 30);
      const totalSupplyAdjusted = totalSupplyBigInt / BigInt(10 ** 18);
      return Number(poolValueAdjusted) / Number(totalSupplyAdjusted);
    }

    return 1; // Default value if data is missing
  } catch (error) {
    console.error('Error fetching LLP price:', error);
    return 1; // Default value on error
  }
};

// Example usage:
getLlpPrice().then(price => {
  console.log('LLP Price:', price);
});
