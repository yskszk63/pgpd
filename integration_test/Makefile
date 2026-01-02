.PHONY: test-node clean

define require_var
	$(if $(TARHREF),,$(error TARHREF is not set))
endef

test-node:
	$(call require_var)
	npm i $(TARHREF) disposablestack es-arraybuffer-base64
	node --import=disposablestack/auto --import=es-arraybuffer-base64/auto ./test.mjs

test-bun:
	$(call require_var)
	bun i $(TARHREF)
	bun ./test.mjs

clean:
	$(RM) -r node_modules/ package-lock.json package.json
