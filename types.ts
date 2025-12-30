import { Buffer } from "node:buffer";

import * as z from "zod/mini";

export type AuthenticationMD5Password = {
  salt: Buffer;
};

export const zAuthenticationMD5Password: z.ZodMiniType<
  AuthenticationMD5Password
> = z.object({
  salt: z.custom<Buffer>((v) => v instanceof Buffer),
});

export type ParameterDescriptionMessage = {
  parameterCount: number;
  dataTypeIDs: number[];
};

export const zParameterDescriptionMessage: z.ZodMiniType<
  ParameterDescriptionMessage
> = z.object({
  parameterCount: z.number(),
  dataTypeIDs: z.array(z.number()),
});

export type RowDescriptionMessage = {
  fieldCount: number;
  fields: {
    name: string;
    tableID: number;
    columnID: number;
    dataTypeID: number;
    dataTypeSize: number;
    dataTypeModifier: number;
    format: "text" | "binary";
  }[];
};

export const zRowDescriptionMessage: z.ZodMiniType<RowDescriptionMessage> = z
  .object({
    fieldCount: z.number(),
    fields: z.array(z.object({
      name: z.string(),
      tableID: z.number(),
      columnID: z.number(),
      dataTypeID: z.number(),
      dataTypeSize: z.number(),
      dataTypeModifier: z.number(),
      format: z.union([z.literal("text"), z.literal("binary")]),
    })),
  });

export type DataRowMessage = {
  fieldCount: number;
  fields: unknown[];
};

export const zDataRowMessage: z.ZodMiniType<DataRowMessage> = z.object({
  fieldCount: z.number(),
  fields: z.array(z.unknown()),
});
