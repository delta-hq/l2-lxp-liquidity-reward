import { getUserTVLByBlock } from "./utils";

export { getUserTVLByBlock };

// const input = {
//     blockNumber: 2954869,
//     blockTimestamp: 1711044141,
// }

// const fileName = 'output.csv';
// console.log('Getting TVL at block:', input.blockNumber);

// // returns all user balances at the input block by looking at the latest
// // balance for each user and token on the subgraph, capped at given block.
// getUserTVLByBlock(input).then((data) => {
//     if (data.length === 0) {
//         console.log("no data to write to file");
//         return;
//     }
//     writeCsv(data, fileName).then(() => {
//         console.log('CSV written to file:', fileName);
//     })
// });