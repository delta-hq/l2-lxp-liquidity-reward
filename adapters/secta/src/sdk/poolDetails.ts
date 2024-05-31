import BigNumber from "bignumber.js";
import { V2Pair, getV2Positions } from "./subgraphDetails";
import { LiquidityInfo } from "./liquidityTypes";

export const getV2LpValue = async (pairs: V2Pair[], blockNumber: number): Promise<LiquidityInfo> => {
    const liquidityInfo: LiquidityInfo = {};

    // fetch all balances
    const positions = await getV2Positions(blockNumber);
    // convert positions array into account->position map
    const positionMap = new Map(positions.map((pos) => [pos.id, pos]));
    // convert pair array into pair address -> pair map
    const pairMap = new Map(pairs.map((pair) => [pair.id, pair]));
    //

    for (const pos of positions) {
        // Get the user's balance of the LP token as a BigNumber
        const userLpBalance = new BigNumber(pos.liquidity);
        const userAddress = pos.account;
        const pair = pairMap.get(pos.pairId);
        if (!pair || pair?.totalSupply === 0) continue;

        const totalSupply = new BigNumber(pair.totalSupply);

        const userShare = userLpBalance.dividedBy(totalSupply);

        // Calculate user's share of token0 and token1
        const token0Amount = userShare.multipliedBy(new BigNumber(pair.reserve0));
        const token1Amount = userShare.multipliedBy(new BigNumber(pair.reserve1));

        // Ensure user's entry exists in the liquidity info
        if (!liquidityInfo[userAddress]) {
            liquidityInfo[userAddress] = {};
        }

        // Populate or update the user's share for token0
        const existingToken0 = liquidityInfo[userAddress][pair.token0.id];
        if (existingToken0) {
            existingToken0.amount += token0Amount.toNumber();
        } else {
            liquidityInfo[userAddress][pair.token0.id] = {
                amount: token0Amount.toNumber(),
                decimals: pair.token0.decimals,
            };
        }

        // Populate or update the user's share for token1
        const existingToken1 = liquidityInfo[userAddress][pair.token1.id];
        if (existingToken1) {
            existingToken1.amount += token1Amount.toNumber();
        } else {
            liquidityInfo[userAddress][pair.token1.id] = {
                amount: token1Amount.toNumber(),
                decimals: pair.token1.decimals,
            };
        }
    }

    return liquidityInfo;
};
