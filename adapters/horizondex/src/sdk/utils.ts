import {TokenPricingSnapshot} from "./tokenPricingSnapshot";

export function findClosestTokenSnapshot(tokenSnapshots: TokenPricingSnapshot[] | undefined, target: number): TokenPricingSnapshot | undefined {
    if (!tokenSnapshots){
        return undefined
    }
    let left: number = 0;
    let right: number = tokenSnapshots.length - 1;

    while (left <= right) {
        const mid: number = Math.floor((left + right) / 2);

        if (tokenSnapshots[mid].periodStartUnix >= target && tokenSnapshots[mid - 1].periodStartUnix < target) {
            if (tokenSnapshots[mid].priceUSD != "0")
                return tokenSnapshots[mid]
            return tokenSnapshots[mid + 1]
        }
        if (target < tokenSnapshots[mid].periodStartUnix) right = mid - 1;
        else left = mid + 1;
    }

    return undefined;
}
