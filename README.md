# txt.udia.ca

[![Tests](https://github.com/udiaca/txt.udia.ca/actions/workflows/tests.yml/badge.svg)](https://github.com/udiaca/txt.udia.ca/actions/workflows/tests.yml)

[A command line pastebin](https://txt.udia.ca) running on [Cloudflare Workers](https://workers.cloudflare.com/) using [KV](https://developers.cloudflare.com/kv/) and [Cloudflare Turnstile CAPTCHAs](https://www.cloudflare.com/en-ca/application-services/products/turnstile/).

## Quickstart

```sh
npm i
cp .env.example .env
npm run start
```

- `npm run test`: run `vitest`
- `npm run deploy`: deploy the CF worker to production

## Environment Variables

- `CF_TURNSTILE_SITE_KEY`: Cloudflare Turnstile Site Key
- `CF_TURNSTILE_SECRET_KEY`: Cloudflare Turnstile Secret Key
- `UDIA_SECRET_KEY`: Password for shell scripting, curl bypass captcha

## License

Licensed under the [WTFPL](https://www.wtfpl.net/about/).
