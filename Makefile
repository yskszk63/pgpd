.PHONY: nop test npm test-it-node clean

npm_files := npm/index.js npm/bin/index.js npm/index.d.ts npm/README.md npm/LICENSE
version := $(shell jq -r ".version" npm/package.json)

esbuild := deno x npm:esbuild@0.27.2
tsc := deno x npm:typescript@5.9.3/tsc


nop:

test:
	deno test --allow-run=docker --allow-net --allow-write=/tmp --allow-read=/tmp --allow-env=PG*,POSTGRESQL_VER

npm/index.js:
	$(esbuild) --bundle mod.ts --outfile=$@ --platform=node --external:pg-protocol --external:zod/mini --format=esm --target=es2023

npm/bin/index.js:
	$(esbuild) --bundle cli.ts --outfile=$@ --platform=node --external:pg-protocol --external:zod/mini --format=esm --target=es2023 --banner:js='#!/usr/bin/env node'

npm/index.d.ts:
	$(tsc) --declaration --emitDeclarationOnly --outDir npm/ --lib esnext ./src/api/index.ts

npm/README.md: README.md
	cp $< $@

npm/LICENSE: LICENSE
	cp $< $@

npm: $(npm_files)

npm/pgpd-$(version).tgz: npm
	(cd npm && npm pack)

test-it-node: npm/pgpd-$(version).tgz
	$(MAKE) -C integration_test/node/ test DATABASE_URL='postgres://postgres:password@localhost:5432/postgres?sslmode=disable'

clean:
	$(RM) -rf $(npm_files) npm/pgpd-*.tgz npm/node_modules/
