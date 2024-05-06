import Web3 from 'web3';
import BigNumber from "bignumber.js";
import { V2MintedUserAddresses, V2Pair } from './subgraphDetails';
import { LiquidityInfo } from './liquidityTypes';
import { SECTA_V2_LP } from './abis';


export const getERC20TokenBalanceAtBlock = async (rpc: string, tokenAddress: string, userAddress: string, blockNumber: number): Promise<BigInt> => {

    const web3 = new Web3(new Web3.providers.HttpProvider(rpc));
    const contract = new web3.eth.Contract(SECTA_V2_LP, tokenAddress);
    
    const balanceHex = await contract.methods.balanceOf(userAddress).call({}, blockNumber);

    // Convert the balance from hex to a decimal string
    const balance: BigInt = web3.utils.toBigInt(balanceHex);
    return balance;
};

export const getV2LpValue = async (rpc: string, pairs: V2Pair[], mintedAddresses: V2MintedUserAddresses, blockNumber: number): Promise<LiquidityInfo> => {

    const liquidityInfo: LiquidityInfo = {};

    const WAD = new BigNumber("1000000000000000000");

    for (const pair of pairs) {
        const userAddresses = mintedAddresses[pair.id] || new Set<string>();

        for (const userAddress of userAddresses) {
            // Get the user's balance of the LP token as a BigNumber
            const userLpBalanceBigInt = await getERC20TokenBalanceAtBlock(
                rpc,
                pair.id,
                userAddress,
                blockNumber
            );
            const userLpBalance = new BigNumber(userLpBalanceBigInt.toString());

            const totalSupply = new BigNumber(pair.totalSupply);

            const userShare = userLpBalance.dividedBy(totalSupply);

            // Calculate user's share of token0 and token1
            const token0Amount = userShare
                .multipliedBy(new BigNumber(pair.reserve0))
                .dividedBy(WAD);
            const token1Amount = userShare
                .multipliedBy(new BigNumber(pair.reserve1))
                .dividedBy(WAD);

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
    }

    return liquidityInfo;
};