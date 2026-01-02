.PHONY: test clean

test:
	npm i ../../npm/pgpd-*.tgz disposablestack es-arraybuffer-base64
	node --import=disposablestack/auto --import=es-arraybuffer-base64/auto ./test.mjs

clean:
	$(RM) -r node_modules/ package-lock.json package.json
