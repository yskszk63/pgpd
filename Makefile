.PHONY: nop test

nop:

test:
	deno test --allow-run=docker --allow-net
