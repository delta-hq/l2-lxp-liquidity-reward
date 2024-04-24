import type { Provider } from "@ethersproject/providers";
import { CallOverrides, Contract, Signer, providers } from "ethers";
import { IMulticall3__factory } from "./factories/IMulticall3__factory";
import { MULTICALL } from "../config";

type Factory<T extends Contract> = {
  createInterface: () => T["interface"];
  connect: (address: string, signerOrProvider: Signer | Provider) => T;
};

type RemoveCallOverrides<T> = T extends [
  ...args: infer O,
  overrides?: CallOverrides
]
  ? O
  : never;

type CallArg<
  T extends Contract,
  F extends keyof ReturnType<T["connect"]>["callStatic"] & string
> = {
  contractAddress: string;
  function_name: F;
  arguments: Readonly<
    [
      ...RemoveCallOverrides<
        Parameters<ReturnType<T["connect"]>["callStatic"][F]>
      >
    ]
  >;
  allowFailure?: boolean;
};

export async function multicall<
  T extends Contract,
  B extends boolean,
  F extends keyof T["callStatic"] & string
>(
  provider: providers.JsonRpcProvider,
  factory: Factory<T>,
  calls: Array<CallArg<T, F>>,
  options?: {
    key?: (
      arg: CallArg<T, F>,
      index: number
    ) => Promise<string | number> | (string | number);
    allowFailure?: B;
    callOverrides?: CallOverrides;
  }
) {
  const {
    key = (arg: CallArg<T, F>) => arg.contractAddress,
    allowFailure = false,
    callOverrides = {},
  } = options ?? {};

  const Interface = factory.createInterface();
  const results = await IMulticall3__factory.connect(
    MULTICALL,
    provider
  ).callStatic.aggregate3(
    calls.map((arg) => ({
      target: arg.contractAddress,
      callData: Interface.encodeFunctionData(arg.function_name, arg.arguments),
      allowFailure: arg.allowFailure ?? allowFailure,
    })),
    callOverrides
  );

  if (results.length !== calls.length) {
    throw new Error("Multicall failed");
  }

  type Return = Awaited<ReturnType<ReturnType<T["connect"]>["callStatic"][F]>>;
  return Object.fromEntries(
    await Promise.all(
      results.map(async (r, i) => {
        if (!r.success) {
          [await key(calls[i], i), undefined];
        }
        try {
          const decoded = Interface.decodeFunctionResult(
            calls[i].function_name,
            r.returnData
          );
          return [
            await key(calls[i], i),
            decoded.length === 1 ? decoded[0] : decoded,
          ];
        } catch {
          /* empty */
        }
        return [await key(calls[i], i), undefined];
      })
    )
  ) as Record<
    Awaited<ReturnType<typeof key>>,
    B extends true ? undefined | Return : Return
  >;
}
