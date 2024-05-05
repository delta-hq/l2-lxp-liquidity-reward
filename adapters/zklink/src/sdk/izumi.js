const { Web3 } = require("web3");
const { getLiquidityValue } = require("iziswap-sdk/lib/liquidityManager/calc");
const LiquidityManagerABI = require("../abi/LiquidityManager.json");
const PoolABI = require("../abi/Pool.json");
const ERC20ABI = require("../abi/ERC20.json");

function decodeMethodResult(contract, methodName, data) {
  const methodAbi = contract.options.jsonInterface.find(
    (abi) => abi.name === methodName && abi.type === "function"
  );
  if (methodAbi && methodAbi.outputs) {
    return web3.eth.abi.decodeParameters(methodAbi.outputs, data);
  } else {
    throw new Error("Method not found or no outputs defined");
  }
}

const web3 = new Web3("https://rpc.zklink.io");

const liquidityManager = new web3.eth.Contract(
  LiquidityManagerABI,
  "0x936c9A1B8f88BFDbd5066ad08e5d773BC82EB15F"
);

async function getPoolState(pool, blockNumber) {
  const {
    sqrtPrice_96,
    currentPoint,
    observationCurrentIndex,
    observationQueueLen,
    observationNextQueueLen,
    liquidity,
    liquidityX,
  } = await pool.methods.state().call({}, blockNumber);
  return {
    sqrtPrice_96: sqrtPrice_96.toString(),
    currentPoint: Number(currentPoint),
    observationCurrentIndex: Number(observationCurrentIndex),
    observationQueueLen: Number(observationQueueLen),
    observationNextQueueLen: Number(observationNextQueueLen),
    liquidity: liquidity.toString(),
    liquidityX: liquidityX.toString(),
  };
}

async function getLiquidities(poolInfos, blockNumber) {
  const totalSupply = await liquidityManager.methods
    .liquidityNum()
    .call({}, blockNumber);
  console.info("totalSupply", totalSupply);

  const batch_size = 10;

  let errorList = [];

  const res = [];

  const poolIds = Array.from(poolInfos.keys());

  async function getLiquiditiesInfo(startId, endId) {
    for (let i = startId; i < endId; i += batch_size) {
      let batchCalls = [];
      let ownerCalls = [];
      let liquidityIds = [];
      let ownershipDict = {};

      for (let j = i; j < Math.min(i + batch_size, Number(totalSupply)); j++) {
        const data = liquidityManager.methods.liquidities(j).encodeABI();
        batchCalls.push(data);
      }

      try {
        const liquidities = await liquidityManager.methods
          .multicall(batchCalls)
          .call({}, blockNumber);
        liquidities.forEach((t, index) => {
          const data_decoded = decodeMethodResult(
            liquidityManager,
            "liquidities",
            t
          );
          if (
            poolIds.includes(data_decoded.poolId) &&
            data_decoded.liquidity != 0
          ) {
            liquidityIds.push({
              id: i + index,
              liquidity: data_decoded.liquidity,
              leftPt: data_decoded.leftPt,
              rightPt: data_decoded.rightPt,
              poolId: data_decoded.poolId,
            });
            const ownerData = liquidityManager.methods
              .ownerOf(i + index)
              .encodeABI();
            ownerCalls.push(ownerData);
          }
        });

        const owners = await liquidityManager.methods
          .multicall(ownerCalls)
          .call({}, blockNumber);
        owners.forEach((owner, index) => {
          const owner_d = "0x" + owner.slice(26); //decodeMethodResult(liquidityManager, 'ownerOf', owner)
          const info = liquidityIds[index];
          if (!ownershipDict[owner_d]) {
            ownershipDict[owner_d] = [];
          }
          ownershipDict[owner_d].push(info);
        });

        for (const [owner, lps] of Object.entries(ownershipDict)) {
          let sum = 0;
          for (let lp of lps) {
            const curPoolId = lp.poolId;
            const poolInfo = poolInfos.get(curPoolId);
            const sdkLiquidity = {
              leftPoint: lp.leftPt,
              rightPoint: lp.rightPt,
              liquidity: lp.liquidity,
              tokenX: poolInfo.tokenX,
              tokenY: poolInfo.tokenY,
            };
            const { amountX, amountY } = getLiquidityValue(
              sdkLiquidity,
              poolInfo.state
            );
            const row = `${owner},${lp.id},${lp.liquidity},${poolInfo.tokenX.symbol},${poolInfo.tokenY.symbol},${amountX},${amountY},${curPoolId}`;
            const item = {
              address: owner,
              amount: poolInfo.tokenX.symbol === "WETH" ? amountX : amountY,
            };
            res.push(item);
            console.log(row);
            // csvContent += row + "\n";
          }
        }
        // fs.writeFileSync(outputFile, csvContent, "utf8");
      } catch (error) {
        errorList.push(i);
        console.error(`Error fetching batch starting at ${i}:`, error);
      }
      console.info("current process: ", i + batch_size);
    }
  }

  await getLiquiditiesInfo(0, totalSupply);

  console.error(`Error fetching batch starting ids:`, errorList);

  const deepCopyErrorList = JSON.parse(JSON.stringify(errorList));
  for (let id of deepCopyErrorList) {
    await getLiquiditiesInfo(id, id + batch_size);
  }

  return res;
}

export async function getAllLiquidities(blockNumber) {
  const poolList = [
    // "0x55a367cf8ba4ce47e48e41179de98c549f17a8e5", // USDC.Eth/ETH
    // "0x82b7dbfdc869a529cbcfc89dc384b0222427ff91",

    ["0xd4b701a553005464292e978efd8abc48252a7722", 6706], //USDC.Arbi/ETH 6706
    ["0x5457c04370c447aed563489d9fe0b1d057439e0b", 419777], // USDC/ETH 419777
    ["0xc2909feb6f46e19f2b40f9288ac63726d7c2612c", 392843], //USDT.Arbi/ETH 392843
    ["0x28592307d115f883acc87763803c3679c0d42fb1", 403], //ETH/USDC.Linea 403
    ["0x062c027e4736f90bb06ba4bfc8036f133fd99413", 487248], //USDT/ETH 487248
    ["0xe3905d48be8aedb1be57c8ad924c40de7e4fb4ff", 310208], // USDT.Eth/ETH 310208
    ["0xe8a8f1d76625b03b787f6ed17bd746e0515f3aef", 477718], // USDT/ETH None 477718
    ["0xfa38f432429d59ba653d5746cfea4f734f2c251e", 156656], //USDC.Eth/ETH 156656
    ["0x39abf030516e346f6c6779d03b260a4449705ce0", 166457], // USDC.op/ETH 166457
    ["0xbc2a3ff0ce7413c184086b532bc121318117cacb", 322503], //rsETH.Arbitrum/ETH 322503
    ["0x802e9743d3421ce5786bc24aac90bbba404f82dd", 435556], //USDC/ETH 435556
  ]
    .filter((config) => config[1] < blockNumber)
    .map((config) => config[0]);

  const poolInfos = new Map();
  for (const poolAddress of poolList) {
    const pool = new web3.eth.Contract(PoolABI, poolAddress);
    const poolId = await liquidityManager.methods.poolIds(poolAddress).call();
    const poolMeta = await liquidityManager.methods.poolMetas(poolId).call();
    const tokenXContract = new web3.eth.Contract(ERC20ABI, poolMeta.tokenX);
    const tokenYContract = new web3.eth.Contract(ERC20ABI, poolMeta.tokenY);
    const tokenXSymbol = await tokenXContract.methods.symbol().call();
    const tokenYSymbol = await tokenYContract.methods.symbol().call();
    const tokenXDecimal = await tokenXContract.methods.decimals().call();
    const tokenYDecimal = await tokenYContract.methods.decimals().call();
    const tokenX = {
      chainId: 810180,
      symbol: tokenXSymbol,
      address: poolMeta.tokenX,
      decimal: tokenXDecimal,
    };

    const tokenY = {
      chainId: 810180,
      symbol: tokenYSymbol,
      address: poolMeta.tokenY,
      decimal: tokenYDecimal,
    };
    const state = await getPoolState(pool, blockNumber);
    poolInfos.set(poolId, {
      id: poolId,
      tokenX: tokenX,
      tokenY: tokenY,
      state: state,
    });
    console.info("set:", poolAddress);
  }

  const data = await getLiquidities(poolInfos, blockNumber);
  return data;
}
