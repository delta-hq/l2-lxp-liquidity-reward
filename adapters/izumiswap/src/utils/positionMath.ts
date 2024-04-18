import BigNumber from "bignumber.js";

export interface TokenInfoFormatted {
  chainId: number;
  name?: string;
  symbol: string;
  address: string;
  decimal: number;
}
export interface Liquidity {
  leftPoint: number;
  rightPoint: number;
  liquidity: string;
  decimalX: number;
  decimalY: number;
}

export const point2PoolPriceUndecimalSqrt = (point: number) : number => {
  return (1.0001 ** point) ** 0.5;
}

export const _getAmountY = (
  liquidity: BigNumber,
  sqrtPriceL: number,
  sqrtPriceR: number,
  sqrtRate: number,
  upper: boolean,
): BigNumber => {
  const numerator = sqrtPriceR - sqrtPriceL;
  const denominator = sqrtRate - 1;
  if (!upper) {
      const amount = new BigNumber(liquidity.times(numerator).div(denominator).toFixed(0, 3));
      return amount;
  } else {
      const amount = new BigNumber(liquidity.times(numerator).div(denominator).toFixed(0, 2));
      return amount;
  }
}

export const _getAmountX = (
  liquidity: BigNumber,
  leftPt: number,
  rightPt: number,
  sqrtPriceR: number,
  sqrtRate: number,
  upper: boolean,
): BigNumber => {
  const sqrtPricePrPc = Math.pow(sqrtRate, rightPt - leftPt + 1);
  const sqrtPricePrPd = Math.pow(sqrtRate, rightPt + 1);

  const numerator = sqrtPricePrPc - sqrtRate;
  const denominator = sqrtPricePrPd - sqrtPriceR;

  if (!upper) {
      const amount = new BigNumber(liquidity.times(numerator).div(denominator).toFixed(0, 3));
      return amount;
  } else {
      const amount = new BigNumber(liquidity.times(numerator).div(denominator).toFixed(0, 2));
      return amount;
  }
}

export const _liquidity2AmountYAtPoint = (
  liquidity: BigNumber,
  sqrtPrice: number,
  upper: boolean
): BigNumber => {
  const amountY = liquidity.times(sqrtPrice);
  if (!upper) {
      return new BigNumber(amountY.toFixed(0, 3));
  } else {
      return new BigNumber(amountY.toFixed(0, 2));
  }
}

export const _liquidity2AmountXAtPoint = (
  liquidity: BigNumber,
  sqrtPrice: number,
  upper: boolean
): BigNumber => {
  const amountX = liquidity.div(sqrtPrice);
  if (!upper) {
      return new BigNumber(amountX.toFixed(0, 3));
  } else {
      return new BigNumber(amountX.toFixed(0, 2));
  }
}

export const amount2Decimal = (amount: BigNumber, decimal: number): number => {
  return Number(amount.div(10 ** decimal))
}

export const getLiquidityValue = (
  liquidity: Liquidity,
  currentPoint: number
): {amountXDecimal: number, amountYDecimal: number, amountX: BigNumber, amountY: BigNumber} => {
  
  let amountX = new BigNumber(0);
  let amountY = new BigNumber(0);
  const liquid = liquidity.liquidity;
  const sqrtRate = Math.sqrt(1.0001);
  const leftPtNum = Number(liquidity.leftPoint);
  const rightPtNum = Number(liquidity.rightPoint);
  // compute amountY without currentPt
  if (leftPtNum < currentPoint) {
      const rightPt: number = Math.min(currentPoint, rightPtNum);
      const sqrtPriceR = point2PoolPriceUndecimalSqrt(rightPt);
      const sqrtPriceL = point2PoolPriceUndecimalSqrt(leftPtNum);
      amountY = _getAmountY(new BigNumber(liquid), sqrtPriceL, sqrtPriceR, sqrtRate, false);
  }
  
  // compute amountX without currentPt
  if (rightPtNum > currentPoint + 1) {
      const leftPt: number = Math.max(currentPoint + 1, leftPtNum);
      const sqrtPriceR = point2PoolPriceUndecimalSqrt(rightPtNum);
      amountX = _getAmountX(new BigNumber(liquid), leftPt, rightPtNum, sqrtPriceR, sqrtRate, false);
  }

  // compute amountX and amountY on currentPt
  if (leftPtNum <= currentPoint && rightPtNum > currentPoint) {
      const liquidityValue = new BigNumber(liquidity.liquidity);
      const maxLiquidityYAtCurrentPt = new BigNumber(0);
      const liquidityYAtCurrentPt = liquidityValue.gt(maxLiquidityYAtCurrentPt) ? maxLiquidityYAtCurrentPt : liquidityValue;
      const liquidityXAtCurrentPt = liquidityValue.minus(liquidityYAtCurrentPt);
      const currentSqrtPrice = point2PoolPriceUndecimalSqrt(currentPoint);
      amountX = amountX.plus(_liquidity2AmountXAtPoint(liquidityXAtCurrentPt, currentSqrtPrice, false));
      amountY = amountY.plus(_liquidity2AmountYAtPoint(liquidityYAtCurrentPt, currentSqrtPrice, false));
  }
  const amountXDecimal:number = amount2Decimal(
      amountX, liquidity.decimalX
  )?? 0;
  const amountYDecimal:number = amount2Decimal(
      amountY, liquidity.decimalY
  )?? 0;
  return {
      amountX, amountXDecimal,
      amountY, amountYDecimal
  };
}

export const PositionMath = {
  getLiquidityValue
}
