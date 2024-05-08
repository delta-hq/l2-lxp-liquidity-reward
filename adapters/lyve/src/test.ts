import { getUserTVLByBlock } from './index';  
interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

const testBlocks: BlockData[] = [
    { blockNumber: 19824214, blockTimestamp: 1715158745 },
];
async function testGetUserTVLByBlock() {
    try {
        const results = await getUserTVLByBlock(testBlocks[0]); 
        console.log("Test Results:", results);
    } catch (error) {
        console.error("Error during testing:", error);
    }
}

testGetUserTVLByBlock();
