function getTickAtSqrtPrice(sqrtPriceX96: bigint): number {
    const Q96: bigint = 2n ** 96n;
    return Math.floor(Math.log(Number(sqrtPriceX96 / Q96) ** 2) / Math.log(1.0001));
}

export const getTokenAmounts = async(
    liquidity: bigint,
    sqrtPriceX96: bigint,
    tickLow: number,
    tickHigh: number,
    Decimal0: number,
    Decimal1: number
)=> {
    const Q96: bigint = 2n ** 96n;
    const sqrtRatioA: number = Math.sqrt(1.0001 ** tickLow);
    const sqrtRatioB: number = Math.sqrt(1.0001 ** tickHigh);
    const currentTick: number = getTickAtSqrtPrice(sqrtPriceX96);
    const sqrtPrice: number = Number(sqrtPriceX96 / Q96);
    let amount0: bigint = 0n;
    let amount1: bigint = 0n;

    // print all the values
    console.log("liquidity : " + liquidity.toString());
    console.log("sqrtPriceX96 : " + sqrtPriceX96.toString());
    console.log("tickLow : " + tickLow);
    console.log("tickHigh : " + tickHigh);
    console.log("Decimal0 : " + Decimal0);
    console.log("Decimal1 : " + Decimal1);
    console.log("sqrtRatioA : " + sqrtRatioA);
    console.log("sqrtRatioB : " + sqrtRatioB);
    console.log("currentTick : " + currentTick);
    console.log("sqrtPrice : " + sqrtPrice);
    

    if (currentTick < tickLow) {
        amount0 = BigInt(Math.floor(Number(liquidity) * ((sqrtRatioB - sqrtRatioA) / (sqrtRatioA * sqrtRatioB))));
    } else if (currentTick >= tickHigh) {
        amount1 = BigInt(Math.floor(Number(liquidity) * (sqrtRatioB - sqrtRatioA)));
    } else if (currentTick >= tickLow && currentTick < tickHigh) {
        amount0 = BigInt(Math.floor(Number(liquidity) * ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB))));
        amount1 = BigInt(Math.floor(Number(liquidity) * (sqrtPrice - sqrtRatioA)));
    }
	let amount0Human: string = (Number(amount0) / 10 ** Decimal0).toFixed(Decimal0);
	let amount1Human: string = (Number(amount1) / 10 ** Decimal1).toFixed(Decimal1);

	console.log("Amount Token0 in lowest decimal: " + amount0.toString());
	console.log("Amount Token1 in lowest decimal: " + amount1.toString());
	console.log("Amount Token0 : " + amount0Human);
	console.log("Amount Token1 : " + amount1Human);
    return [amount0, amount1];
}
