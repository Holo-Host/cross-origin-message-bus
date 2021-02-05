
NAME			= holo_hosting_comb

build/index.js:		src/index.ts
	npm run compile

dist/$(NAME).js:	build/index.js webpack.config.js
	npm run bundle

docs/index.html:	build/index.js
	npx jsdoc --verbose -c ./docs/.jsdoc.json --private --destination ./docs build/index.js

package-lock.json: package.json 
	npm install
	touch $@
node_modules: package-lock.json


.PHONY:		src build dist docs docs-watch dist-watch preview-package publish-docs publish-package

build:			node_modules build/index.js
dist:			node_modules dist/$(NAME).js
docs:			node_modules docs/index.html


MOCHA_OPTS	= --timeout 5000

test:			dist
	npx mocha $(MOCHA_OPTS) --recursive ./tests
test-debug:		dist
	LOG_LEVEL=silly npx mocha $(MOCHA_OPTS) --recursive ./tests
test-unit:		dist
	LOG_LEVEL=silly npx mocha $(MOCHA_OPTS) ./tests/unit/
test-integration:	dist
	LOG_LEVEL=silly npx mocha $(MOCHA_OPTS) ./tests/integration/

docs-watch:
	npx chokidar -d 3000 'src/**/*.ts' -c "make --no-print-directory docs" 2> /dev/null
dist-watch:
	npx chokidar -d 3000 'src/**/*.ts' -c "make --no-print-directory dist" 2> /dev/null

clean-docs:
	git clean -df ./docs

static-servers:
	cd ./html/happ/; python3 -m http.server 8001 &
	cd ./html/chaperone/; python3 -m http.server 8002


preview-package: dist
	npm pack --dry-run .

publish-package: test
	npm publish --access public .


CURRENT_BRANCH = $(shell git branch | grep \* | cut -d ' ' -f2)
publish-docs:
	git branch -D gh-pages || true
	git checkout -b gh-pages
	echo "\nBuilding docs"
	make docs
	ln -s docs v$$( cat package.json | jq -r .version )
	@echo "\nAdding docs..."
	git add -f docs
	git add v$$( cat package.json | jq -r .version )
	@echo "\nCreating commit..."
	git commit -m "JSdocs v$$( cat package.json | jq -r .version )"
	@echo "\nForce push to gh-pages"
	git push -f origin gh-pages
	git checkout $(CURRENT_BRANCH)
