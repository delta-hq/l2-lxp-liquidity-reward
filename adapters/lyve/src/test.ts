import { getUserTVLByBlock } from './index';  
interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

const testBlocks: BlockData[] = [
    { blockNumber: 4372798, blockTimestamp: 1715162083 },
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
