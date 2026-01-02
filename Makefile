.PHONY: nop test

nop:

test:
	deno test --allow-run=docker --allow-net --allow-write=/tmp --allow-read=/tmp --allow-env=PG*

npm/index.js:
	deno x npm:esbuild --bundle mod.ts --outfile=$@ --platform=node --external:pg-protocol --external:zod/mini --format=esm --target=esnext

npm/bin/index.js:
	deno x npm:esbuild --bundle cli.ts --outfile=$@ --platform=node --external:pg-protocol --external:zod/mini --format=esm --target=esnext

npm/index.d.ts:
	deno x npm:typescript/tsc --declaration --emitDeclarationOnly -t esnext -m nodenext --moduleResolution nodenext --outFile $@ ./src/api.ts
