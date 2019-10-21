
NAME			= holo_hosting_comb

build/index.js:		src/index.ts
	npx tsc --esModuleInterop --lib es2015,dom --outDir ./build ./src/index.ts

dist/$(NAME).js:	src/index.js
	npx webpack --mode production --output-filename $(NAME).js ./src/index.js

docs/index.html:	build/index.js
	npx jsdoc --verbose -c ./docs/.jsdoc.json --destination ./docs build/index.js


.PHONY:		src build dist docs watch-docs

build:			dist/$(NAME).js
dist:			dist/$(NAME).js
docs:			docs/index.html

test:
	npx mocha --recursive ./tests
test-debug:
	LOG_LEVEL=silly npx mocha --recursive ./tests
test-unit:
	LOG_LEVEL=silly npx mocha ./tests/unit/
test-integration:
	LOG_LEVEL=silly npx mocha ./tests/integration/

watch-docs:
	npx chokidar -d 3000 'src/**/*.ts' -c "make --no-print-directory docs" 2> /dev/null

clean-docs:
	git clean -df ./docs
