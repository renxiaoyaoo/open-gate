import handler from "vinext/server/fetch-handler";
import { withDatabase } from "./db";

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return withDatabase(env.DB as import("./db").Database, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
