.PHONY: help install lint test format build preview clean

help:
	@echo "Targets:"
	@echo "  install   Install the package and dev deps in the current venv"
	@echo "  lint      Run ruff + mypy"
	@echo "  test      Run pytest"
	@echo "  format    Apply ruff formatting"
	@echo "  build     Render the Essential pack for Sony A7 IV into dist/"
	@echo "  preview   Render P-001 and open it"
	@echo "  clean     Remove build artifacts"

install:
	pip install -e ".[dev]"
	pre-commit install

lint:
	ruff check src tests
	mypy src

test:
	pytest

format:
	ruff format src tests
	ruff check --fix src tests

build:
	posingincam build --camera sony-a7iv --pack essential --out dist/sony-a7iv

preview:
	posingincam preview P-001

clean:
	rm -rf build dist *.egg-info .pytest_cache .mypy_cache .ruff_cache htmlcov
	find . -type d -name __pycache__ -exec rm -rf {} +
