import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("txt.udia.ca worker", () => {
  it("responds with not found and proper status for /404", async () => {
    const response = await SELF.fetch("http://example.com/404");
    expect(await response.status).toBe(404);
    expect(await response.text()).toBe("not found\n");
  });

  it("handles storing and retrieving text data using secret key", async () => {
    const payload = `＂fullwidth quote＂\n"double quote"\n'single quote'\n`;
    const formdata = new FormData();
    formdata.append("txt", payload);
    const createResp = await SELF.fetch("http://example.com/", {
      method: "POST",
      headers: {
        "UDIA-SECRET-KEY": env.UDIA_SECRET_KEY,
      },
      body: formdata
    });
    expect(await createResp.status).toBe(200);

    const storedUrl = await createResp.text();
    const readResp = await SELF.fetch(storedUrl, {
      method: "GET",
    });
    expect(await readResp.status).toBe(200);
    const readText = await readResp.text();
    expect(readText).toBe(payload);
    expect(readText).not.toBe("ï¼‚fullwidth quoteï¼‚\n\"double quote\"\n'single quote'\n");
  });
});
