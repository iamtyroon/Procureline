import {
  buildProcurelineServiceHeaders,
  resolveNestjsUrl,
} from "./procureline-service-auth";

export interface NestServiceRequestArgs {
  body?: unknown;
  path: string;
  token: string;
}

export function createNestServiceRequest(args: NestServiceRequestArgs): {
  init: RequestInit;
  url: string;
} {
  return {
    init: {
      body: args.body === undefined ? undefined : JSON.stringify(args.body),
      headers: buildProcurelineServiceHeaders(args.token),
      method: "POST",
    },
    url: `${resolveNestjsUrl()}${args.path}`,
  };
}
