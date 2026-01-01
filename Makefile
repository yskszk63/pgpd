.PHONY: nop test

nop:

test:
	deno test --allow-run=docker --allow-net --allow-write=/tmp --allow-read=/tmp --allow-env=PG*
