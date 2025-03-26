"use server";

import {
  wrapMinaSignature as wrapMinaSignatureLib,
  WrapMinaSignatureParams,
} from "@dex-example/lib";

export async function wrapMinaSignature(params: WrapMinaSignatureParams) {
  const wrapped = await wrapMinaSignatureLib(params);
  return wrapped;
}
