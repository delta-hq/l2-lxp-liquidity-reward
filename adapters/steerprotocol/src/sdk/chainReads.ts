import { Provider, ethers } from "ethers"
import { RPC_URLS, CHAINS } from "./config"

export async function getCurrentTickAtBlock(pool: string, block: number): Promise<number> {

    const provider = new ethers.JsonRpcProvider(RPC_URLS[CHAINS.L2_CHAIN_ID])

    // pool abi - try uniswap - try algebra
    const algGlobalState = ['function globalState() view returns ( uint160 price, int24 tick, uint16 fee, uint16 timepointIndex, uint16 communityFeeToken0, uint16 communityFeeToken1, bool unlocked)']
    // const algebraABI = [{"inputs":[],"name":"globalState","outputs":[{"internalType":"uint160","name":"price","type":"uint160"},{"internalType":"int24","name":"tick","type":"int24"},{"internalType":"uint16","name":"fee","type":"uint16"},{"internalType":"uint16","name":"timepointIndex","type":"uint16"},{"internalType":"uint16","name":"communityFeeToken0","type":"uint16"},{"internalType":"uint16","name":"communityFeeToken1","type":"uint16"},{"internalType":"bool","name":"unlocked","type":"bool"}],"stateMutability":"view","type":"function"}]
    const uniSlot0 = ['function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)']
    // const uniswapABI = [{"inputs":[],"name":"slot0","outputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"internalType":"int24","name":"tick","type":"int24"},{"internalType":"uint16","name":"observationIndex","type":"uint16"},{"internalType":"uint16","name":"observationCardinality","type":"uint16"},{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"},{"internalType":"uint8","name":"feeProtocol","type":"uint8"},{"internalType":"bool","name":"unlocked","type":"bool"}],"stateMutability":"view","type":"function"}]

    let tick = 0
    try {
        const contract = new ethers.Contract(pool, uniSlot0, provider);
        const functionFragment = contract.interface.getFunction('slot0');
        if (!functionFragment) throw new Error();
        const callData = contract.interface.encodeFunctionData(functionFragment, []);
        const tx = {
            to: pool,
            data: callData,
        };

        const result = await provider.call({ ...tx, blockTag: block });

        // Decode the result
        const decodedResult = contract.interface.decodeFunctionResult(functionFragment, result);
        tick = decodedResult.tick
    } catch (error) {
        try {
            const contract = new ethers.Contract(pool, algGlobalState, provider);
            const functionFragment = contract.interface.getFunction('globalState');
            if (!functionFragment) throw new Error();
            const callData = contract.interface.encodeFunctionData(functionFragment, []);
            const tx = {
                to: pool,
                data: callData,
            };

            const result = await provider.call({ ...tx, blockTag: block });

            // Decode the result
            const decodedResult = contract.interface.decodeFunctionResult(functionFragment, result);
            tick = decodedResult.tick
        } catch (error) {
            console.log('Error fetching pool current tick: ', error)
        }
    }
    return tick
}