.PHONY: nop test npm test-it-node clean

npm_files := npm/index.js npm/bin/index.js npm/index.d.ts
version = 0.1.1

nop:

test:
	deno test --allow-run=docker --allow-net --allow-write=/tmp --allow-read=/tmp --allow-env=PG*,POSTGRESQL_VER

npm/index.js:
	deno x npm:esbuild --bundle mod.ts --outfile=$@ --platform=node --external:pg-protocol --external:zod/mini --format=esm --target=es2023

npm/bin/index.js:
	deno x npm:esbuild --bundle cli.ts --outfile=$@ --platform=node --external:pg-protocol --external:zod/mini --format=esm --target=es2023

npm/index.d.ts:
	deno x npm:typescript/tsc --declaration --emitDeclarationOnly --outDir npm/ --lib esnext ./src/api/index.ts

npm: $(npm_files)

npm/pgpd-$(version).tgz: npm
	(cd npm && npm pack)

test-it-node: npm/pgpd-$(version).tgz
	$(MAKE) -C integration_test/node/ test DATABASE_URL='postgres://postgres:password@localhost:5432/postgres?sslmode=disable'

clean:
	$(RM) $(npm_files)
