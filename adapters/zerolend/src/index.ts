import { ethers } from "ethers";
import axios from "axios";
import { write } from "fast-csv";
import fs from "fs";
import { MulticallWrapper } from "ethers-multicall-provider";

const lineaProvider = new ethers.JsonRpcProvider("https://rpc.linea.build	");

const abi = ["function balanceOf(address owner) view returns (uint256)"];

type IKeyObject = { [symbol: string]: string };
const assetAddresses: IKeyObject = {
  MAI: "0x759cb97fbc452BAFD49992BA88d3C5dA4Dd9B0e7",
  ezETH: "0x0684FC172a0B8e6A65cF4684eDb2082272fe9050",
  GRAI: "0xE7e54ca3D6F8a5561f8cee361260E537BDc5bE48",
  ETH: "0xB4FFEf15daf4C02787bC5332580b838cE39805f5",
  debtETH: "0xCb2dA0F5aEce616e2Cbf29576CFc795fb15c6133",
  USDC: "0x2E207ecA8B6Bf77a6ac82763EEEd2A94de4f081d",
  debtUSDC: "0xa2703Dc9FbACCD6eC2e4CBfa700989D0238133f6",
  USDT: "0x508C39Cd02736535d5cB85f3925218E5e0e8F07A",
  debtUSDT: "0x476F206511a18C9956fc79726108a03E647A1817",
};

const underlyingAddresses: IKeyObject = {
  MAI: "0xf3b001d64c656e30a62fbaaca003b1336b4ce12a",
  ezETH: "0x2416092f143378750bb29b79ed961ab195cceea5",
  GRAI: "0x894134a25a5fac1c2c26f1d8fbf05111a3cb9487",
  ETH: "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f",
  USDC: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",
  USDT: "0xa219439258ca9da29e9cc4ce5596924745e12b93",
};

const getUserAssetBalance = async (
  tokenAddress: string,
  walletAddress: string[]
) => {
  const provider = MulticallWrapper.wrap(lineaProvider);
  const contract = new ethers.Contract(tokenAddress, abi, provider);

  const results = await Promise.all(
    walletAddress.map((w) => contract.balanceOf(w))
  );
  const resp = results.map((amount, index) => {
    return { address: walletAddress[index], balance: Number(amount) };
  });
  return resp;
};

export const userBalance = async (walletAddress: string[]) => {
  //mai
  const balanceMAI = await getUserAssetBalance(
    assetAddresses.MAI,
    walletAddress
  );

  //ezETH
  const balanceezETH = await getUserAssetBalance(
    assetAddresses.ezETH,
    walletAddress
  );

  //   GRAI
  const balanceGRAI = await getUserAssetBalance(
    assetAddresses.GRAI,
    walletAddress
  );

  //ETH
  const balanceETHSupply = await getUserAssetBalance(
    assetAddresses.ETH, //z0WETH
    walletAddress
  );
  const balanceETHBorrow = await getUserAssetBalance(
    assetAddresses.debtETH, // debt WETH
    walletAddress
  );

  //usdc
  const balanceUSDCSupply = await getUserAssetBalance(
    assetAddresses.USDC, //z0USDC
    walletAddress
  );
  const balanceUSDCBorrow = await getUserAssetBalance(
    assetAddresses.debtUSDC, // debt z0USDC
    walletAddress
  );

  //usdt
  const balanceUSDTSupply = await getUserAssetBalance(
    assetAddresses.USDT, // z0USDT
    walletAddress
  );
  const balanceUSDTBorrow = await getUserAssetBalance(
    assetAddresses.debtUSDT, // debt z0USDT
    walletAddress
  );

  const finalResult = balanceMAI.map((mai, index) => {
    return {
      address: mai.address,
      balance: {
        MAI: mai.balance,
        ezETH: balanceezETH[index].balance,
        GRAI: balanceGRAI[index].balance,
        ETH: balanceETHSupply[index].balance - balanceETHBorrow[index].balance,
        USDC:
          balanceUSDCSupply[index].balance - balanceUSDCBorrow[index].balance,
        USDT:
          balanceUSDTSupply[index].balance - balanceUSDTBorrow[index].balance,
      },
    };
  });
  return finalResult;
};

export const main = async () => {
  const blockNumber = await lineaProvider.getBlockNumber();
  const timestamp = new Date();
  const first = 100;
  let batch;
  let lastAddress = "0x0000000000000000000000000000000000000000";
  const queryURL =
    "https://api.studio.thegraph.com/query/65585/zerolend-linea-market/version/latest";
  const rows: any = [];

  do {
    const graphQuery = `query {
        users(where: {id_gt: "${lastAddress}"}, first: ${first}) {
          id
        }
      }`;

    const headers = {
      "Content-Type": "application/json",
    };
    batch = await axios.post(queryURL, { query: graphQuery }, { headers });
    const addresses = batch.data.data.users.map((user: any) => user.id);

    const balance = await userBalance(addresses);

    balance.forEach((user) => {
      Object.entries(user.balance).map(([key, value]) => {
        if (value !== 0)
          rows.push([
            String(blockNumber),
            String(timestamp.toISOString()),
            user.address,
            underlyingAddresses[key], // Retrieve corresponding address from assetAddresses
            String(value),
          ]);
      });
    });
    console.log(`Processed ${rows.length} rows`);
    lastAddress = batch.data.data.users[batch.data.data.users.length - 1].id;
    await userBalanceCSV(rows);
  } while (batch.data.data.users.length === first);
};

export const userBalanceCSV = async (data: any) => {
  // File path where the CSV will be saved
  const filePath = "outputData.csv";
  const headers = [
    "block_number",
    "timestamp",
    "user_address",
    "token_address",
    "token_balance",
  ];

  // Create a write stream
  const fileStream = fs.createWriteStream(filePath);

  // Create a CSV writer
  const csvStream = write([]);

  csvStream.pipe(fileStream);
  csvStream.write(headers);
  data.forEach((row: any) => {
    csvStream.write(row);
  });

  csvStream.on("finish", () => {
    console.log("CSV file has been written successfully.");
    csvStream.end();
  });
};

main().then(() => {
  console.log("Done");
});
