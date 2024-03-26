import { ethers } from "ethers";
import { write } from "fast-csv";
import axios from "axios";
import fs from "fs";

import {
  Multicall,
  ContractCallResults,
  ContractCallContext,
} from "ethereum-multicall";

const abi = [
  {
    constant: true,
    inputs: [
      {
        name: "_owner",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "balance",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

const assets = [
  {
    symbol: "WETH",
    aToken: "0xB4FFEf15daf4C02787bC5332580b838cE39805f5",
    underlying: "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f",
    debtToken: "0xCb2dA0F5aEce616e2Cbf29576CFc795fb15c6133",
  },
  {
    symbol: "USDC",
    aToken: "0x2E207ecA8B6Bf77a6ac82763EEEd2A94de4f081d",
    underlying: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",
    debtToken: "0xa2703Dc9FbACCD6eC2e4CBfa700989D0238133f6",
  },
  {
    symbol: "USDT",
    aToken: "0x508C39Cd02736535d5cB85f3925218E5e0e8F07A",
    underlying: "0xa219439258ca9da29e9cc4ce5596924745e12b93",
    debtToken: "0x476F206511a18C9956fc79726108a03E647A1817",
  },
  {
    symbol: "MAI",
    aToken: "0x759cb97fbc452BAFD49992BA88d3C5dA4Dd9B0e7",
    underlying: "0xf3b001d64c656e30a62fbaaca003b1336b4ce12a",
    debtToken: "",
  },
  {
    symbol: "GRAI",
    aToken: "0xE7e54ca3D6F8a5561f8cee361260E537BDc5bE48",
    underlying: "0x894134a25a5fac1c2c26f1d8fbf05111a3cb9487",
    debtToken: "",
  },
  {
    symbol: "ezETH",
    aToken: "0x0684FC172a0B8e6A65cF4684eDb2082272fe9050",
    underlying: "0x2416092f143378750bb29b79ed961ab195cceea5",
    debtToken: "",
  },
];

const lineaProvider = new ethers.providers.JsonRpcProvider(
  "https://rpc.linea.build"
);

const multicall = new Multicall({
  ethersProvider: lineaProvider,
  tryAggregate: true,
});

const fetchUserBalancesMulticall = async (walletAddresses: string[]) => {
  const contractCallContext: ContractCallContext[] = assets.reduce<
    ContractCallContext[]
  >((previous, asset) => {
    const calls = [
      {
        reference: `${asset.symbol}-aToken`,
        contractAddress: asset.aToken,
        abi,
        calls: walletAddresses.map((walletAddress) => ({
          reference: `${asset.aToken}-${walletAddress}`,
          methodName: "balanceOf",
          methodParameters: [walletAddress],
        })),
      },
    ];

    if (asset.debtToken != "") {
      calls.push({
        reference: `${asset.symbol}-debtToken`,
        contractAddress: asset.debtToken,
        abi,
        calls: walletAddresses.map((walletAddress) => ({
          reference: `${asset.debtToken}-${walletAddress}`,
          methodName: "balanceOf",
          methodParameters: [walletAddress],
        })),
      });
    }

    return [...calls, ...previous];
  }, []);

  const results: ContractCallResults = await multicall.call(
    contractCallContext
  );

  const flattenedResults: {
    address: string;
    asset: string;
    balance: string;
    blockNumber: number;
  }[] = [];

  const values = Object.values(results.results);
  values.forEach((value) => {
    value.callsReturnContext.forEach((ret) => {
      const balance = ethers.BigNumber.from(ret.returnValues[0]).toString();

      if (balance === "0") return;

      flattenedResults.push({
        address: ret.methodParameters[0],
        asset: ret.reference.split("-")[0],
        balance: ret.reference.includes("debt") ? "-" : "" + balance,
        blockNumber: results.blockNumber,
      });
    });
  });

  const finalResults: {
    address: string;
    asset: string;
    balance: string;
    blockNumber: number;
  }[] = [];

  flattenedResults.forEach((res) => {
    const index = finalResults.findIndex((val) => val.asset);
    if (index > 0) {
      finalResults[index] = {
        ...finalResults[index],
        balance: (
          Number(finalResults[index].balance) + Number(res.balance)
        ).toString(),
      };
    } else finalResults.push(res);
  });

  return finalResults;
};

const writeToCSV = async (data: [string, string, string, string, string][]) => {
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
  const csvStream: any = write<any, any>([]);

  csvStream.pipe(fileStream);
  csvStream.write(headers);
  data.forEach(csvStream.write);

  csvStream.on("finish", () => {
    console.log("CSV file has been written successfully.");
    csvStream.end();
  });
};

const getAddresses = async () => {
  console.log("fetching users");
  const count = 1000;

  let lastAddress = "0x0000000000000000000000000000000000000000";
  const queryURL =
    "https://api.studio.thegraph.com/query/65585/zerolend-linea-market/version/latest";

  const addresses: string[] = [];

  do {
    const query = `query {
        users(where: {id_gt: "${lastAddress}"}, first: ${count}) {
          id
        }
      }`;

    const headers = {
      "Content-Type": "application/json",
    };

    const batch = await axios.post<IAxiosReponse>(
      queryURL,
      { query },
      { headers }
    );

    const results = batch.data.data.users.map((user) => user.id);
    addresses.push(...results);
    lastAddress = batch.data.data.users[batch.data.data.users.length - 1].id;

    if (batch.data.data.users.length !== count) break;
  } while (true);

  console.log("fetched users", addresses.length);
  return addresses;
};

interface IAxiosReponse {
  data: {
    users: {
      id: string;
    }[];
  };
}

const main = async () => {
  const rows: [string, string, string, string, string][] = [];
  const addresses = await getAddresses();

  const batches = 10;

  for (let index = 0; index < addresses.length / batches; index++) {
    const subaddresses = addresses.slice(
      index * batches,
      (index + 1) * batches
    );
    const balance = await fetchUserBalancesMulticall(subaddresses);
    balance.forEach((row) => {
      rows.push([
        row.blockNumber.toString(),
        String(new Date().toISOString()),
        row.address,
        row.asset,
        row.balance,
      ]);
    });
    console.log(
      `Processed ${rows.length} rows`,
      index,
      Math.floor(addresses.length / batches)
    );
  }

  await writeToCSV(rows);
};

main().then(() => {
  console.log("Done");
});
