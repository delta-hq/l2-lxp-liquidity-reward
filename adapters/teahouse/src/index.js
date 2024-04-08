"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = exports.getUserTVLByBlock = void 0;
var fs = require("fs");
var fast_csv_1 = require("fast-csv");
var config_1 = require("./sdk/config");
var ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
var post = function (url, data) { return __awaiter(void 0, void 0, void 0, function () {
    var response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify(data),
                })];
            case 1:
                response = _a.sent();
                return [4 /*yield*/, response.json()];
            case 2: return [2 /*return*/, _a.sent()];
        }
    });
}); };
var getLatestBlockNumberAndTimestamp = function () { return __awaiter(void 0, void 0, void 0, function () {
    var data, blockNumber, blockTimestamp;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, post(config_1.RPC_URLS[59144 /* CHAINS.LINEA */], {
                    jsonrpc: "2.0",
                    method: "eth_getBlockByNumber",
                    params: ["latest", false],
                    id: 1,
                })];
            case 1:
                data = _a.sent();
                blockNumber = parseInt(data.result.number);
                blockTimestamp = parseInt(data.result.timestamp);
                return [2 /*return*/, { blockNumber: blockNumber, blockTimestamp: blockTimestamp }];
        }
    });
}); };
function writeProgress(endBlock, numCompleted, total) {
    var percentage_progress = (numCompleted / total * 100).toFixed(2);
    var filled_bar = Math.floor(parseFloat(percentage_progress) / 10);
    var empty_bar = 10 - filled_bar;
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write("Block ".concat(endBlock, " - Progress:[").concat('#'.repeat(filled_bar)).concat('-'.repeat(empty_bar), "] ").concat(percentage_progress, "%"));
}
var getUserTVLByBlock = function (blocks) { return __awaiter(void 0, void 0, void 0, function () {
    var blockNumber, blockTimestamp, userSharesSnapshotsAtBlockData, snapshotsArrays, skip, b_end, timestamp_end, b_start, transferQuery, responseJson, transferData, addressBalances;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                blockNumber = blocks.blockNumber, blockTimestamp = blocks.blockTimestamp;
                userSharesSnapshotsAtBlockData = [];
                snapshotsArrays = [];
                skip = 0;
                b_end = blockNumber;
                timestamp_end = blockTimestamp;
                b_start = 0;
                _a.label = 1;
            case 1:
                if (!true) return [3 /*break*/, 3];
                transferQuery = "\n      query TransferQuery {\n        transfers(\n          skip: ".concat(skip, ",\n          first: 1000,\n          orderBy: block_number, \n          orderDirection: asc,\n          where: {\n            block_number_lte: ").concat(b_end, ",\n            timestamp__lte: ").concat(timestamp_end, "\n          }\n        ) {\n          contractId_\n          from\n          to\n          value\n          timestamp_\n          block_number\n        }\n      }");
                return [4 /*yield*/, post(config_1.SUBGRAPH_URL, { query: transferQuery })];
            case 2:
                responseJson = _a.sent();
                transferData = responseJson;
                snapshotsArrays = snapshotsArrays.concat(transferData.data.transfers);
                if (transferData.data.transfers.length !== 1000) {
                    return [3 /*break*/, 3];
                }
                skip += 1000;
                if (skip > 5000) {
                    skip = 0;
                    b_start = snapshotsArrays[snapshotsArrays.length - 1].block_number + 1;
                }
                writeProgress(b_end, b_start, b_end);
                return [3 /*break*/, 1];
            case 3:
                addressBalances = {};
                snapshotsArrays.forEach(function (transfer) {
                    var contractId_ = transfer.contractId_, from = transfer.from, to = transfer.to, value = transfer.value;
                    var bigIntValue = BigInt(value);
                    if (from !== ZERO_ADDRESS) {
                        if (!addressBalances[from]) {
                            addressBalances[from] = {};
                        }
                        addressBalances[from][contractId_] = (addressBalances[from][contractId_] || BigInt(0)) - bigIntValue;
                    }
                    if (to !== ZERO_ADDRESS) {
                        if (!addressBalances[to]) {
                            addressBalances[to] = {};
                        }
                        addressBalances[to][contractId_] = (addressBalances[to][contractId_] || BigInt(0)) + bigIntValue;
                    }
                });
                Object.entries(addressBalances).forEach(function (_a) {
                    var address = _a[0], balances = _a[1];
                    Object.entries(balances).forEach(function (_a) {
                        var contractId = _a[0], balance = _a[1];
                        var tokenSymbol = config_1.POOL_SYMBOL[contractId] || "";
                        userSharesSnapshotsAtBlockData.push({
                            block_number: blockNumber,
                            timestamp: timestamp_end,
                            user_address: address,
                            token_address: contractId,
                            token_symbol: tokenSymbol,
                            token_balance: Number(balance),
                            usd_price: 0, // Assuming USD price is not available
                        });
                    });
                });
                return [2 /*return*/, userSharesSnapshotsAtBlockData];
        }
    });
}); };
exports.getUserTVLByBlock = getUserTVLByBlock;
var main = function (blocks) { return __awaiter(void 0, void 0, void 0, function () {
    var allCsvRows, batchSize, i, _i, blocks_1, _a, blockNumber, blockTimestamp, csvRows, ws, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                allCsvRows = [];
                batchSize = 10;
                i = 0;
                _i = 0, blocks_1 = blocks;
                _b.label = 1;
            case 1:
                if (!(_i < blocks_1.length)) return [3 /*break*/, 6];
                _a = blocks_1[_i], blockNumber = _a.blockNumber, blockTimestamp = _a.blockTimestamp;
                _b.label = 2;
            case 2:
                _b.trys.push([2, 4, , 5]);
                return [4 /*yield*/, (0, exports.getUserTVLByBlock)({ blockNumber: blockNumber, blockTimestamp: blockTimestamp })];
            case 3:
                csvRows = _b.sent();
                // Accumulate CSV rows for all blocks
                allCsvRows.push.apply(allCsvRows, csvRows);
                i++;
                console.log("Processed block ".concat(i));
                // Write to file when batch size is reached or at the end of loop
                if (i % batchSize === 0 || i === blocks.length) {
                    ws = fs.createWriteStream('outputData.csv');
                    (0, fast_csv_1.write)(allCsvRows, { headers: true }).pipe(ws).on('finish', function () {
                        console.log("CSV file has been written.");
                    });
                    // Clear the accumulated CSV rows
                    allCsvRows.length = 0;
                }
                return [3 /*break*/, 5];
            case 4:
                error_1 = _b.sent();
                console.error("An error occurred for block ".concat(blockNumber, ":"), error_1);
                return [3 /*break*/, 5];
            case 5:
                _i++;
                return [3 /*break*/, 1];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.main = main;
getLatestBlockNumberAndTimestamp().then(function (latestBlockData) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log("Snapshot at:", latestBlockData);
        (0, exports.main)([latestBlockData]);
        return [2 /*return*/];
    });
}); }).catch(function (error) {
    console.error('Error in fetchLatestBlockData:', error);
});
