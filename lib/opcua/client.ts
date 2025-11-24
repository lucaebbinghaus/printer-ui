// lib/opcua/client.ts
import {
  OPCUAClient,
  AttributeIds,
  MessageSecurityMode,
  SecurityPolicy,
  Variant,
  DataType,
  CallMethodRequestLike,
} from "node-opcua";
import { OPCUA_ENDPOINT } from "./config";

export async function connectOPCUA() {
  const client = OPCUAClient.create({
    applicationName: "printer-ui",
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    connectionStrategy: { initialDelay: 500, maxRetry: 3 },
  });

  await client.connect(OPCUA_ENDPOINT);
  const session = await client.createSession();
  return { client, session };
}

export async function readNode(session: any, nodeId: string) {
  const dv = await session.read({
    nodeId,
    attributeId: AttributeIds.Value,
  });
  return dv?.value?.value;
}

export async function callMethod(
  session: any,
  objectId: string,
  methodId: string,
  inputArguments: Variant[]
) {
  const req: CallMethodRequestLike = {
    objectId,
    methodId,
    inputArguments,
  };
  const res = await session.call(req);
  if (res.statusCode?.isNotGood()) {
    throw new Error(res.statusCode.toString());
  }
  return res.outputArguments;
}

export const V = {
  str: (s: string) => new Variant({ dataType: DataType.String, value: s }),
  i32: (n: number) => new Variant({ dataType: DataType.Int32, value: n }),
  u32: (n: number) => new Variant({ dataType: DataType.UInt32, value: n }),
  bool: (b: boolean) => new Variant({ dataType: DataType.Boolean, value: b }),
};
