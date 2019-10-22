
NAME			= holo_hosting_comb

build/index.js:		src/index.ts
	npx tsc --esModuleInterop --lib es2015,dom --outDir ./build ./src/index.ts

dist/$(NAME).js:	build/index.js
	npx webpack --mode production --output-filename $(NAME).js --target web --output-library-target window ./build/index.js

docs/index.html:	build/index.js
	npx jsdoc --verbose -c ./docs/.jsdoc.json --private --destination ./docs build/index.js


.PHONY:		src build dist docs docs-watch dist-watch

build:			build/$(NAME).js
dist:			dist/$(NAME).js
docs:			docs/index.html

MOCHA_OPTS	= --timeout 5000

test:
	npx mocha $(MOCHA_OPTS) --recursive ./tests
test-debug:
	LOG_LEVEL=silly npx mocha $(MOCHA_OPTS) --recursive ./tests
test-unit:
	LOG_LEVEL=silly npx mocha $(MOCHA_OPTS) ./tests/unit/
test-integration:
	LOG_LEVEL=silly npx mocha $(MOCHA_OPTS) ./tests/integration/

docs-watch:
	npx chokidar -d 3000 'src/**/*.ts' -c "make --no-print-directory docs" 2> /dev/null
dist-watch:
	npx chokidar -d 3000 'src/**/*.ts' -c "make --no-print-directory dist" 2> /dev/null

clean-docs:
	git clean -df ./docs

static-servers:
	cd ./html/happ/; python3 -m http.server 8001 &
	cd ./html/chaperon/; python3 -m http.server 8002

CURRENT_BRANCH = $(shell git branch | grep \* | cut -d ' ' -f2)
publish-docs:
	git branch -D gh-pages || true
	git checkout -b gh-pages
	make docs
	ln -s docs v$$( cat package.json | jq -r .version )
	git add -f docs
	git add v$$( cat package.json | jq -r .version )
	git commit -m "JSdocs v$$( cat package.json | jq -r .version )"
	git push -f origin gh-pages
	git checkout $(CURRENT_BRANCH)
