.PHONY: all demo

# Pre-commit checks; requires Node.js, Go, percli, curl and network access.
all:
	git diff --check
	git diff --cached --check
	npm ci
	npm run type-check
	npm run lint
	npm test -- --runInBand
	npm run test:integration
	npm run build
	percli plugin test-schemas
	percli plugin build

demo:
	scripts/run-demo.sh
