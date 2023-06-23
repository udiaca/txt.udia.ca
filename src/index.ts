import hljs from "highlight.js";
import { bestMatch } from "@udia/mime-parser";

export interface Env {
  txtblob: KVNamespace;
  CF_TURNSTILE_SITE_KEY: string | undefined;
  CF_TURNSTILE_SECRET_KEY: string | undefined;
  UDIA_SECRET_KEY: string | undefined;
}

const HLJS_SITE = "https://highlightjs.org/";
const HLJS_LANGS =
  "https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md";
const TXT_SOURCE = "https://github.com/udiaca/txt.udia.ca";
const T0_SOURCE = "https://github.com/tannercollin/t0txt";
const SPRUNGE_SOURCE = "https://github.com/rupa/sprunge";

const getForm = (
  origin: string,
  cfTurnstileSiteKey: string
) => `<form action="${origin}" method="POST" accept-charset="UTF-8">
<input name="web" type="hidden" value="true">
<textarea name="txt" cols="60" rows="8"></textarea>
<div class="cf-turnstile" data-sitekey="${cfTurnstileSiteKey}"></div>
<br><button type="submit">Submit</button></form>`;

const mainBody = (origin: string, cfTurnstileSiteKey: string) => `<!DOCTYPE html>
<html>
<head>
<title>txt.udia.ca</title>
<style>a { text-decoration: none }</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
<pre>
txt.udia.ca(1)                    txt.udia.ca                    txt.udia.ca(1)

NAME
    txt.udia.ca: command line pastebin.

USAGE
    &lt;command&gt; | curl -H 'UDIA-SECRET-KEY: udiasecretkeyvalue' -F 'txt=&lt;-' ${origin}

    where udiasecretkeyvalue should be replaced with a valid secret,

    or submit using the following form${getForm(origin, cfTurnstileSiteKey)}

DESCRIPTION
    Entries will be automatically highlighted using <a href='${HLJS_SITE}'>highlight.js</a>.
    Add <a href='${HLJS_LANGS}'>?&lt;lang&gt;</a> to resulting url for manual language syntax highlighting.

    Submitted entries will DISAPPEAR after 24 hours!

    Add this to your .*rc to enable piping directly to txt (sed removes colours):

    alias txt=" \\
    sed -r 's/\[([0-9]{{1,2}}(;[0-9]{{1,2}})?)?[m|K]//g' \\
    | curl -H 'UDIA-SECRET-KEY: udiasecretkeyvalue' -F 'txt=<-' ${origin}"

EXAMPLES
    ~$ echo 'print("Hello world!")' | curl -H 'UDIA-SECRET-KEY: udiasecretkeyvalue' -F 'txt=&lt;-' ${origin}
       ${origin}/8gad9
    ~$ firefox ${origin}/8gad9?py

SEE ALSO
    <a href="${TXT_SOURCE}">${TXT_SOURCE}</a>
    <a href="${T0_SOURCE}">${T0_SOURCE}</a>
    <a href="${SPRUNGE_SOURCE}">${SPRUNGE_SOURCE}</a>
</pre>
</html>`;

const txtBody = (txtData: string) => `<!DOCTYPE html>
<html>
<style>pre code.hljs{display:block;overflow-x:auto;padding:1em}code.hljs{padding:3px 5px}.hljs{background:#f3f3f3;color:#444}.hljs-comment{color:#697070}.hljs-punctuation,.hljs-tag{color:#444a}.hljs-tag .hljs-attr,.hljs-tag .hljs-name{color:#444}.hljs-attribute,.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-name,.hljs-selector-tag{font-weight:700}.hljs-deletion,.hljs-number,.hljs-quote,.hljs-selector-class,.hljs-selector-id,.hljs-string,.hljs-template-tag,.hljs-type{color:#800}.hljs-section,.hljs-title{color:#800;font-weight:700}.hljs-link,.hljs-operator,.hljs-regexp,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-symbol,.hljs-template-variable,.hljs-variable{color:#ab5656}.hljs-literal{color:#695}.hljs-addition,.hljs-built_in,.hljs-bullet,.hljs-code{color:#397300}.hljs-meta{color:#1f7199}.hljs-meta .hljs-string{color:#38a}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}</style>
<pre><code>${txtData}</code></pre>
</html>`;

const makeId = (len = 4) => {
  const symbols = "abcdefghijklmnopqrstuvwxyz0123456789";
  // random numbers between 0 and 255
  const randByteArr = crypto.getRandomValues(new Uint8Array(len));
  const nId: string[] = [];
  randByteArr.forEach((randByte) => {
    nId.push(symbols[Math.floor((randByte / 256) * symbols.length)]);
  });
  return nId.join("");
};

const handleGet = async (request: Request, url: URL, env: Env, CF_TURNSTILE_SITE_KEY: string) => {
  const path = url.pathname;
  const origin = url.origin;

  if (path === "/") {
    return new Response(mainBody(origin, CF_TURNSTILE_SITE_KEY), {
      headers: {
        "content-type": "text/html",
      },
    });
  }
  const key = path.slice(1);
  const rawTxtDataWithMeta = await env.txtblob.getWithMetadata<{
    createdAt: string;
  }>(key);
  const rawTxtData = rawTxtDataWithMeta.value;
  if (!rawTxtData) {
    return new Response("not found\n", {
      status: 404,
    });
  }
  const createdAt = rawTxtDataWithMeta.metadata?.createdAt;
  const accept = request.headers.get("accept");
  let resp = new Response(rawTxtData);

  const match = bestMatch(["text/plain", "text/html"], accept || "");

  if (match === "text/html") {
    const language = url.search.slice(1);
    const txtHighlightData = !!language
      ? hljs.highlight(rawTxtData, { language })
      : hljs.highlightAuto(rawTxtData);

    const detectedLang = txtHighlightData.language;
    const txtData = txtHighlightData.value;

    resp = new Response(txtBody(txtData), {
      headers: {
        "content-type": "text/html",
      },
    });
    if (detectedLang) {
      resp.headers.set("text-language", detectedLang);
    }
  }

  if (createdAt) {
    resp.headers.set("text-created-at", createdAt);
  }
  return resp;
}

const handlePost = async (request: Request, url: URL, env: Env, CF_TURNSTILE_SECRET_KEY: string, UDIA_SECRET_KEY: string) => {
  const origin = url.origin;
  const formData = await request.formData();
  const rawTxtData = formData.get("txt");
  const isWeb = formData.get("web");

  if (isWeb) {
    const token = formData.get('cf-turnstile-response');
    const ip = request.headers.get('CF-Connecting-IP');
    if (!token) {
      return new Response("cf-turnstile-response must be defined", { status: 400 });
    }
    if (!ip) {
      return new Response("CF-Connecting-IP header must be defined", { status: 400 });
    }

    const turnstileFormData = new FormData();
    turnstileFormData.append('secret', CF_TURNSTILE_SECRET_KEY);
    turnstileFormData.append('response', token);
    turnstileFormData.append('remoteip', ip);

    // Validate the token by calling the "/siteverify" API.
    const turnstileResult = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      body: turnstileFormData,
      method: 'POST',
    });

    const outcome = await turnstileResult.json() as any;
    if (!outcome.success) {
      return new Response('The provided Turnstile token was not valid! \n' + JSON.stringify(outcome), { status: 400 });
    }

  } else {
    // this is a post request made by something like CURL
    // ensure the header UDIA_SECRET_KEY is supplied and matches server key
    const reqUdiaSecretKey = request.headers.get('UDIA-SECRET-KEY');
    if (!reqUdiaSecretKey) {
      return new Response("UDIA-SECRET-KEY header must be defined", { status: 400 });
    }
    if (reqUdiaSecretKey != UDIA_SECRET_KEY) {
      return new Response("UDIA-SECRET-KEY header does not match server", { status: 400 });
    }
  }

  if (!rawTxtData) {
    return new Response("txt formData must be defined\n", {
      status: 400,
    });
  }

  const txtData =
    typeof rawTxtData === "string" ? new TextEncoder().encode(rawTxtData) : rawTxtData.stream();

  const byteSize =
    typeof rawTxtData === "string"
      ? new TextEncoder().encode(rawTxtData).byteLength
      : rawTxtData.size;

  // 500 KiB file size limit
  const limit = 524288;
  if (byteSize > limit) {
    return new Response(
      `exceeds byte size limit of ${limit} bytes (payload is ${byteSize} bytes)\n`,
      {
        status: 413,
        headers: {
          limit: `${limit}`,
          length: `${byteSize}`,
        },
      }
    );
  }

  const key = makeId();
  const opt: KVNamespacePutOptions = {
    expirationTtl: 60 * 60 * 24,
    metadata: { createdAt: new Date().toISOString() },
  };
  await env.txtblob.put(key, txtData, opt);
  const txtPath = `${origin}/${key}`;
  if (!!isWeb) {
    return new Response(txtPath, {
      status: 302,
      headers: { location: txtPath },
    });
  }
  return new Response(`${txtPath}\n`, {
    status: 200,
  });
}

const main = async (request: Request, env: Env, ctx: ExecutionContext) => {
  const method = request.method;
  const url = new URL(request.url);

  const { CF_TURNSTILE_SITE_KEY, CF_TURNSTILE_SECRET_KEY, UDIA_SECRET_KEY } = env;

  if (!CF_TURNSTILE_SITE_KEY) {
    return new Response("CF_TURNSTILE_SITE_KEY must be defined", { status: 500 });
  }
  if (!CF_TURNSTILE_SECRET_KEY) {
    return new Response("CF_TURNSTILE_SECRET_KEY must be defined", { status: 500 });
  }
  if (!UDIA_SECRET_KEY) {
    return new Response("UDIA_SECRET_KEY must be defined", { status: 500 });
  }

  switch (method) {
    case "GET": {
      return await handleGet(request, url, env, CF_TURNSTILE_SITE_KEY)
    }
    case "POST": {
      return await handlePost(request, url, env, CF_TURNSTILE_SECRET_KEY, UDIA_SECRET_KEY)
    }
    default:
      return new Response("method not allowed\n", {
        status: 405,
      });
  }
};

export default {
  fetch: main,
};
