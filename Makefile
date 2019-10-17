
NAME			= holo_hosting_comb

dist/$(NAME).js:	src/index.js
	npx webpack --mode production --output-filename $(NAME).js ./src/index.js

.PHONY:		src build dist docs watch-docs

build:			dist/$(NAME).js
dist:			dist/$(NAME).js

test:
	npx mocha --recursive ./tests
test-debug:
	LOG_LEVEL=silly npx mocha --recursive ./tests

test-unit:
	LOG_LEVEL=silly npx mocha ./tests/unit/
